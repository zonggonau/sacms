import { db } from "@/lib/database"
import { createHmac } from "crypto"
import { waitUntil } from "@vercel/functions"

interface WebhookPayload {
  event: string
  timestamp: string
  data: Record<string, unknown>
  tenant: {
    id: string
    slug: string
  }
}

/**
 * Trigger webhooks for a specific event
 */
export async function triggerWebhooks(
  tenantId: string,
  event: string,
  data: Record<string, unknown>
): Promise<void> {
  try {
    // Get all enabled webhooks for this tenant that subscribe to this event
    const webhooks = await db.webhook.findMany({
      where: {
        tenantId,
        enabled: true,
      },
    })

    // Filter webhooks that subscribe to this event
    const matchingWebhooks = webhooks.filter((webhook) => {
      const events = (webhook.events as unknown as string[])
      return events.includes(event) || events.includes("*")
    })

    if (matchingWebhooks.length === 0) {
      return
    }

    // Get tenant info
    const tenant = await db.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, slug: true },
    })

    if (!tenant) {
      console.error("Tenant not found for webhook trigger")
      return
    }

    // Build payload
    const payload: WebhookPayload = {
      event,
      timestamp: new Date().toISOString(),
      data,
      tenant: {
        id: tenant.id,
        slug: tenant.slug,
      },
    }

    // Fire webhooks asynchronously in the background using waitUntil
    // This allows the main response to be sent immediately while hooks finish
    waitUntil(
      Promise.all(
        matchingWebhooks.map((webhook) => fireWebhook(webhook, payload))
      )
    )
  } catch (error) {
    console.error("Error triggering webhooks:", error)
  }
}

interface WebhookRecord {
  id: string
  url: string
  secret: string | null
  headers: string | null
}

/**
 * Fire a single webhook with retry support.
 * On failure, enqueues to Dead Letter Queue with exponential backoff.
 */
async function fireWebhook(
  webhook: WebhookRecord,
  payload: WebhookPayload
): Promise<void> {
  const startTime = Date.now()
  let success = false
  let statusCode: number | null = null
  let responseBody: string | null = null
  let errorMessage: string | null = null

  try {
    // Build headers
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Webhook-Event": payload.event,
      "X-Webhook-Timestamp": payload.timestamp,
      "X-Webhook-ID": webhook.id,
    }

    // Add custom headers if any
    if (webhook.headers) {
      try {
        const customHeaders = JSON.parse(webhook.headers) as Record<string, string>
        Object.assign(headers, customHeaders)
      } catch {
        console.error(`Webhook ${webhook.id}: Failed to parse custom headers, skipping`)
      }
    }

    // Add signature if secret is configured
    const payloadString = JSON.stringify(payload)
    if (webhook.secret) {
      const signature = createHmac("sha256", webhook.secret)
        .update(payloadString)
        .digest("hex")
      headers["X-Webhook-Signature"] = `sha256=${signature}`
    }

    // Send webhook
    const response = await fetch(webhook.url, {
      method: "POST",
      headers,
      body: payloadString,
      signal: AbortSignal.timeout(10000), // 10 second timeout
    })

    statusCode = response.status
    responseBody = await response.text().catch(() => null)
    success = response.status >= 200 && response.status < 300

    if (!success) {
      errorMessage = `HTTP ${response.status}: ${response.statusText}`
    }
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : "Unknown error"
    console.error(`Webhook ${webhook.id} failed:`, errorMessage)
  }

  const duration = Date.now() - startTime

  // Log the result
  try {
    await db.webhookLog.create({
      data: {
        webhookId: webhook.id,
        event: payload.event,
        payload: payload as any,
        response: responseBody,
        statusCode,
        success,
        duration,
        error: errorMessage,
      },
    })

    // Update webhook stats
    await db.webhook.update({
      where: { id: webhook.id },
      data: {
        lastTriggeredAt: new Date(),
        failureCount: success ? 0 : { increment: 1 },
      },
    })

    // On failure, enqueue to Dead Letter Queue for retry
    if (!success) {
      await enqueueToDeadLetter(webhook.id, payload.event, payload, errorMessage)
    }
  } catch (logError) {
    console.error("Failed to log webhook result:", logError)
  }
}

/**
 * Common webhook events
 */
export const WebhookEvents = {
  // Async events
  CONTENT_CREATED: "content.created",
  CONTENT_UPDATED: "content.updated",
  CONTENT_DELETED: "content.deleted",
  CONTENT_PUBLISHED: "content.published",
  CONTENT_UNPUBLISHED: "content.unpublished",
  MEDIA_UPLOADED: "media.uploaded",
  MEDIA_DELETED: "media.deleted",
  // Sync hooks (before*)
  BEFORE_CREATE: "content.beforeCreate",
  BEFORE_UPDATE: "content.beforeUpdate",
  BEFORE_DELETE: "content.beforeDelete",
  BEFORE_PUBLISH: "content.beforePublish",
} as const

export type WebhookEventType = (typeof WebhookEvents)[keyof typeof WebhookEvents]

// ==================== SYNC HOOKS ====================

interface SyncHookResult {
  allowed: boolean
  modifiedData?: Record<string, unknown>
  rejectMessage?: string
}

/**
 * Execute synchronous hooks (before* events) that can modify data or reject operations.
 * Returns the modified data (or original if no hook modifies it), or rejects with an error.
 *
 * Sync hooks have a 5-second timeout and circuit breaker (disabled after 3 consecutive failures).
 */
export async function executeSyncHooks(
  tenantId: string,
  event: string,
  data: Record<string, unknown>
): Promise<SyncHookResult> {
  const webhooks = await db.webhook.findMany({
    where: {
      tenantId,
      enabled: true,
      hookType: "sync",
      failureCount: { lt: 3 }, // Circuit breaker: skip after 3 failures
    },
  })

  const matchingWebhooks = webhooks.filter((webhook) => {
    const events = (webhook.events as unknown as string[])
    return events.includes(event) || events.includes("*")
  })

  if (matchingWebhooks.length === 0) {
    return { allowed: true }
  }

  const tenant = await db.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true, slug: true },
  })

  if (!tenant) return { allowed: true }

  let currentData = { ...data }

  for (const webhook of matchingWebhooks) {
    const payload: WebhookPayload = {
      event,
      timestamp: new Date().toISOString(),
      data: currentData,
      tenant: { id: tenant.id, slug: tenant.slug },
    }

    const startTime = Date.now()
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "X-Webhook-Event": event,
        "X-Webhook-ID": webhook.id,
      }

      if (webhook.headers) {
        try {
          Object.assign(headers, JSON.parse(webhook.headers) as Record<string, string>)
        } catch {
          console.error(`Sync hook ${webhook.id}: Failed to parse custom headers, skipping`)
        }
      }

      const payloadString = JSON.stringify(payload)
      if (webhook.secret) {
        const signature = createHmac("sha256", webhook.secret)
          .update(payloadString)
          .digest("hex")
        headers["X-Webhook-Signature"] = `sha256=${signature}`
      }

      const response = await fetch(webhook.url, {
        method: "POST",
        headers,
        body: payloadString,
        signal: AbortSignal.timeout(5000), // 5 second timeout for sync hooks
      })

      const responseBody = await response.text()
      const duration = Date.now() - startTime

      // Log
      await db.webhookLog.create({
        data: {
          webhookId: webhook.id,
          event,
          payload: payload as any,
          response: responseBody,
          statusCode: response.status,
          success: response.ok,
          duration,
        },
      }).catch(() => {})

      if (response.ok) {
        // Reset failure count on success
        await db.webhook.update({
          where: { id: webhook.id },
          data: { lastTriggeredAt: new Date(), failureCount: 0 },
        }).catch(() => {})

        try {
          const result = JSON.parse(responseBody) as {
            reject?: boolean
            message?: string
            data?: Record<string, unknown>
          }

          if (result.reject) {
            return {
              allowed: false,
              rejectMessage: result.message || "Rejected by webhook",
            }
          }

          if (result.data && typeof result.data === "object") {
            currentData = result.data
          }
        } catch {
          // Response is not JSON, ignore modification
        }
      } else {
        // Increment failure count
        await db.webhook.update({
          where: { id: webhook.id },
          data: { lastTriggeredAt: new Date(), failureCount: { increment: 1 } },
        }).catch(() => {})
      }
    } catch (error) {
      const duration = Date.now() - startTime
      // Timeout or network error — increment failure count
      await db.webhook.update({
        where: { id: webhook.id },
        data: { lastTriggeredAt: new Date(), failureCount: { increment: 1 } },
      }).catch(() => {})

      await db.webhookLog.create({
        data: {
          webhookId: webhook.id,
          event,
          payload: payload as any,
          success: false,
          duration,
          error: error instanceof Error ? error.message : "Unknown error",
        },
      }).catch(() => {})
    }
  }

  return { allowed: true, modifiedData: currentData }
}

// ==================== DEAD LETTER QUEUE & RETRY ====================

/** Exponential backoff delays in milliseconds: 1s, 5s, 30s, 5m, 30m */
const RETRY_DELAYS_MS = [1000, 5000, 30000, 300000, 1800000]
const MAX_RETRY_ATTEMPTS = 5

/**
 * Enqueue a failed webhook delivery to the Dead Letter Queue.
 */
async function enqueueToDeadLetter(
  webhookId: string,
  event: string,
  payload: WebhookPayload,
  error: string | null
): Promise<void> {
  try {
    const nextRetryAt = new Date(Date.now() + RETRY_DELAYS_MS[0])

    await db.webhookDeadLetter.create({
      data: {
        webhookId,
        event,
        payload: payload as any,
        lastError: error,
        attempts: 1,
        maxAttempts: MAX_RETRY_ATTEMPTS,
        nextRetryAt,
        status: "pending",
      },
    })
  } catch (err) {
    console.error("Failed to enqueue to DLQ:", err)
  }
}

/**
 * Process pending retries in the Dead Letter Queue.
 * Call this from a cron endpoint (e.g., every 1 minute).
 */
export async function processWebhookRetries(): Promise<{
  processed: number
  succeeded: number
  failed: number
  exhausted: number
}> {
  const now = new Date()

  // Get entries ready for retry
  const entries = await db.webhookDeadLetter.findMany({
    where: {
      status: { in: ["pending", "retrying"] },
      nextRetryAt: { lte: now },
    },
    include: {
      webhook: true,
    },
    take: 50, // Process in batches
    orderBy: { nextRetryAt: "asc" },
  })

  let succeeded = 0
  let failed = 0
  let exhausted = 0

  for (const entry of entries) {
    if (!entry.webhook.enabled) {
      // Webhook disabled, mark as exhausted
      await db.webhookDeadLetter.update({
        where: { id: entry.id },
        data: { status: "exhausted", updatedAt: now },
      })
      exhausted++
      continue
    }

    // Attempt delivery
    let success = false
    let errorMessage: string | null = null

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "X-Webhook-Event": entry.event,
        "X-Webhook-Retry-Attempt": String(entry.attempts),
      }

      if (entry.webhook.headers) {
        Object.assign(headers, JSON.parse(entry.webhook.headers) as Record<string, string>)
      }

      if (entry.webhook.secret) {
        const signature = createHmac("sha256", entry.webhook.secret)
          .update(entry.payload)
          .digest("hex")
        headers["X-Webhook-Signature"] = `sha256=${signature}`
      }

      const response = await fetch(entry.webhook.url, {
        method: "POST",
        headers,
        body: entry.payload,
        signal: AbortSignal.timeout(10000),
      })

      success = response.status >= 200 && response.status < 300
      if (!success) {
        errorMessage = `HTTP ${response.status}: ${response.statusText}`
      }
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : "Unknown error"
    }

    if (success) {
      // Remove from DLQ
      await db.webhookDeadLetter.update({
        where: { id: entry.id },
        data: { status: "replayed", updatedAt: now },
      })
      // Reset webhook failure count
      await db.webhook.update({
        where: { id: entry.webhookId },
        data: { failureCount: 0 },
      }).catch(() => {})
      succeeded++
    } else {
      const newAttempts = entry.attempts + 1
      if (newAttempts >= entry.maxAttempts) {
        // Exhausted — no more retries
        await db.webhookDeadLetter.update({
          where: { id: entry.id },
          data: {
            status: "exhausted",
            attempts: newAttempts,
            lastError: errorMessage,
            updatedAt: now,
          },
        })
        exhausted++
      } else {
        // Schedule next retry with exponential backoff
        const delay = RETRY_DELAYS_MS[Math.min(newAttempts, RETRY_DELAYS_MS.length - 1)]
        await db.webhookDeadLetter.update({
          where: { id: entry.id },
          data: {
            status: "retrying",
            attempts: newAttempts,
            lastError: errorMessage,
            nextRetryAt: new Date(Date.now() + delay),
            updatedAt: now,
          },
        })
        failed++
      }
    }
  }

  return { processed: entries.length, succeeded, failed, exhausted }
}

/**
 * Manually replay a single dead letter entry.
 */
export async function replayDeadLetter(deadLetterId: string): Promise<boolean> {
  const entry = await db.webhookDeadLetter.findUnique({
    where: { id: deadLetterId },
    include: { webhook: true },
  })

  if (!entry || !entry.webhook.enabled) return false

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Webhook-Event": entry.event,
      "X-Webhook-Replay": "true",
    }

    if (entry.webhook.headers) {
      Object.assign(headers, JSON.parse(entry.webhook.headers) as Record<string, string>)
    }

    if (entry.webhook.secret) {
      const signature = createHmac("sha256", entry.webhook.secret)
        .update(entry.payload)
        .digest("hex")
      headers["X-Webhook-Signature"] = `sha256=${signature}`
    }

    const response = await fetch(entry.webhook.url, {
      method: "POST",
      headers,
      body: entry.payload,
      signal: AbortSignal.timeout(10000),
    })

    const success = response.status >= 200 && response.status < 300

    await db.webhookDeadLetter.update({
      where: { id: deadLetterId },
      data: {
        status: success ? "replayed" : entry.status,
        lastError: success ? null : `Replay failed: HTTP ${response.status}`,
        updatedAt: new Date(),
      },
    })

    return success
  } catch (err) {
    await db.webhookDeadLetter.update({
      where: { id: deadLetterId },
      data: {
        lastError: `Replay error: ${err instanceof Error ? err.message : "Unknown"}`,
        updatedAt: new Date(),
      },
    }).catch(() => {})
    return false
  }
}
