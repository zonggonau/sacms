"use server"

import { revalidatePath } from "next/cache"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db, Prisma } from "@/lib/database"
import { getTenantAccess } from "@/lib/tenant-access"
import { isWorkspaceAdmin } from "@/lib/rbac/staff"
import { assertPublicUrl } from "@/lib/safe-url"
import { logAudit, AuditAction } from "@/lib/audit-log"
import { createWebhookSchema, updateWebhookSchema } from "@/lib/validations/webhook"
import type { CreateWebhookInput, UpdateWebhookInput } from "@/lib/validations/webhook"

const webhookSummary = {
  id: true,
  name: true,
  url: true,
  events: true,
  enabled: true,
  lastTriggeredAt: true,
  failureCount: true,
  createdAt: true,
} satisfies Prisma.WebhookSelect

async function getAccess(tenantSlug: string, requireAdmin = false) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return { error: "Unauthorized" } as const

  const access = await getTenantAccess(session, tenantSlug)
  if (!access || (requireAdmin && !isWorkspaceAdmin(access.role))) {
    return { error: "Forbidden" } as const
  }

  return { access }
}

export async function getWebhooksAction(tenantSlug: string) {
  try {
    const result = await getAccess(tenantSlug)
    if ("error" in result) return { error: result.error }

    // Definitions, delivery logs, and retries share the platform database.
    const webhooks = await db.webhook.findMany({
      where: { tenantId: result.access.tenantId },
      orderBy: { createdAt: "desc" },
      select: webhookSummary,
    })
    return { webhooks }
  } catch (error) {
    console.error("Error fetching webhooks:", error)
    return { error: "Internal server error" }
  }
}

export async function createWebhookAction(tenantSlug: string, data: CreateWebhookInput) {
  try {
    const result = await getAccess(tenantSlug, true)
    if ("error" in result) return { error: result.error }

    const parsed = createWebhookSchema.safeParse(data)
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Validation failed" }
    const { name, url, secret, enabled, events, headers, hookType } = parsed.data
    if (!await assertPublicUrl(url).catch(() => null)) {
      return { error: "URL webhook harus mengarah ke endpoint HTTP(S) publik." }
    }

    const { tenantId, userId } = result.access
    const webhook = await db.webhook.create({
      data: { tenantId, name, url, secret: secret || null, enabled, events, headers, hookType },
      select: webhookSummary,
    })
    logAudit({ tenantId, userId, action: AuditAction.WEBHOOK_CREATED, entity: "Webhook", entityId: webhook.id })
    revalidatePath(`/dashboard/${tenantSlug}/developer/webhooks`)
    return { webhook }
  } catch (error) {
    console.error("Error creating webhook:", error)
    return { error: "Internal server error" }
  }
}

export async function updateWebhookAction(tenantSlug: string, webhookId: string, data: UpdateWebhookInput) {
  try {
    const result = await getAccess(tenantSlug, true)
    if ("error" in result) return { error: result.error }

    const parsed = updateWebhookSchema.safeParse(data)
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Validation failed" }
    const { name, url, secret, enabled, events, headers, hookType } = parsed.data
    if (url !== undefined && !await assertPublicUrl(url).catch(() => null)) {
      return { error: "URL webhook harus mengarah ke endpoint HTTP(S) publik." }
    }

    const { tenantId, userId } = result.access
    const updated = await db.webhook.updateMany({
      where: { id: webhookId, tenantId },
      data: { name, url, secret: secret === undefined ? undefined : secret || null, enabled, events, headers, hookType },
    })
    if (updated.count === 0) return { error: "Webhook not found" }
    logAudit({ tenantId, userId, action: AuditAction.WEBHOOK_UPDATED, entity: "Webhook", entityId: webhookId })
    revalidatePath(`/dashboard/${tenantSlug}/developer/webhooks`)
    return { success: true }
  } catch (error) {
    console.error("Error updating webhook:", error)
    return { error: "Internal server error" }
  }
}

export async function deleteWebhookAction(tenantSlug: string, webhookId: string) {
  try {
    const result = await getAccess(tenantSlug, true)
    if ("error" in result) return { error: result.error }

    const { tenantId, userId } = result.access
    const deleted = await db.webhook.deleteMany({ where: { id: webhookId, tenantId } })
    if (deleted.count === 0) return { error: "Webhook not found" }
    logAudit({ tenantId, userId, action: AuditAction.WEBHOOK_DELETED, entity: "Webhook", entityId: webhookId })
    revalidatePath(`/dashboard/${tenantSlug}/developer/webhooks`)
    return { success: true }
  } catch (error) {
    console.error("Error deleting webhook:", error)
    return { error: "Internal server error" }
  }
}
