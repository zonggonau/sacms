import { NextResponse } from "next/server"
import { db } from "@/lib/database"
import { logAudit, AuditAction } from "@/lib/audit-log"
import { withAdminAuth, apiError } from "@/lib/api/route-helpers"
import { replayDeadLetter } from "@/lib/webhooks"

export const GET = withAdminAuth(
  async (request) => {
    const { searchParams } = request.nextUrl
    const webhooksPage = parseInt(searchParams.get("webhooksPage") || "1")
    const logsPage = parseInt(searchParams.get("logsPage") || "1")
    const dlqPage = parseInt(searchParams.get("dlqPage") || "1")
    // Paging one tab used to refetch and re-render the other two tabs' lists
    // too, since all three were always fetched together. `scope` lets the
    // client ask for just the tab whose page actually changed.
    const scope = searchParams.get("scope") as "webhooks" | "logs" | "dlq" | null
    const PAGE_SIZE = 30

    const [
      webhooks, webhooksTotal, recentLogs, logsTotal, deadLetters, dlqTotal,
      activeWebhooksCount, successLogsCount, failedLogsCount,
    ] = await Promise.all([
      !scope || scope === "webhooks"
        ? db.webhook.findMany({
            select: {
              id: true,
              tenantId: true,
              name: true,
              url: true,
              enabled: true,
              lastTriggeredAt: true,
              failureCount: true,
              createdAt: true,
              updatedAt: true,
              hookType: true,
              events: true,
              // secret is deliberately excluded — never return it to the admin UI
              tenant: {
                select: { id: true, name: true, slug: true }
              },
              _count: {
                select: { deadLetters: true, logs: true }
              }
            },
            orderBy: { updatedAt: "desc" },
            skip: (webhooksPage - 1) * PAGE_SIZE,
            take: PAGE_SIZE,
          })
        : [],
      db.webhook.count(),
      !scope || scope === "logs"
        ? db.webhookLog.findMany({
            include: {
              webhook: {
                select: { id: true, name: true, url: true, tenantId: true }
              }
            },
            orderBy: { createdAt: "desc" },
            skip: (logsPage - 1) * PAGE_SIZE,
            take: PAGE_SIZE,
          })
        : [],
      db.webhookLog.count(),
      !scope || scope === "dlq"
        ? db.webhookDeadLetter.findMany({
            include: {
              webhook: {
                select: {
                  id: true,
                  name: true,
                  url: true,
                  tenant: { select: { id: true, name: true, slug: true } }
                }
              }
            },
            orderBy: { createdAt: "desc" },
            skip: (dlqPage - 1) * PAGE_SIZE,
            take: PAGE_SIZE,
          })
        : [],
      db.webhookDeadLetter.count(),
      db.webhook.count({ where: { enabled: true } }),
      db.webhookLog.count({ where: { success: true } }),
      db.webhookLog.count({ where: { success: false } }),
    ])

    return NextResponse.json({
      webhooks,
      webhooksPage,
      webhooksTotalPages: Math.ceil(webhooksTotal / PAGE_SIZE),
      recentLogs,
      logsPage,
      logsTotalPages: Math.ceil(logsTotal / PAGE_SIZE),
      deadLetters,
      dlqPage,
      dlqTotalPages: Math.ceil(dlqTotal / PAGE_SIZE),
      stats: {
        totalWebhooks: webhooksTotal,
        activeWebhooks: activeWebhooksCount,
        deadLetterCount: dlqTotal,
        successLogsCount: successLogsCount,
        failedLogsCount: failedLogsCount,
      }
    })
  },
)

export const POST = withAdminAuth(
  async (request, _context, { session }) => {
    const { deadLetterId, action } = await request.json()

    if (action === "retry" && deadLetterId) {
      const deadLetter = await db.webhookDeadLetter.findUnique({
        where: { id: deadLetterId },
        select: { id: true, webhookId: true, event: true, webhook: { select: { tenantId: true } } },
      })

      if (!deadLetter) {
        return apiError("not_found", { message: "Dead letter not found" })
      }

      // Reuse the same HMAC-signed, enabled-aware replay path the automated
      // retry cron uses (processWebhookRetries in lib/webhooks.ts) instead of
      // a bespoke reimplementation that sent no signature at all, ignored
      // webhook.enabled, and used non-canonical X-SaCMS-* headers instead of
      // the X-Webhook-* convention every other delivery path uses.
      const success = await replayDeadLetter(deadLetterId)

      if (success) {
        // Mirror processWebhookRetries: a successful replay clears the
        // circuit-breaker failure count the same way an organic success would.
        await db.webhook.update({ where: { id: deadLetter.webhookId }, data: { failureCount: 0 } }).catch(() => {})
      }

      logAudit({
        userId: session.user.id,
        action: AuditAction.WEBHOOK_DLQ_REPLAYED,
        entity: "WebhookDeadLetter",
        entityId: deadLetterId,
        tenantId: deadLetter.webhook.tenantId,
        data: { event: deadLetter.event, success },
      })

      if (success) {
        return NextResponse.json({ success: true, message: "Webhook retry delivered successfully" })
      }
      const updated = await db.webhookDeadLetter.findUnique({ where: { id: deadLetterId }, select: { lastError: true } })
      return NextResponse.json({ success: false, error: updated?.lastError || "Delivery failed" }, { status: 400 })
    }

    if (action === "purge_all") {
      const { count } = await db.webhookDeadLetter.deleteMany({})
      logAudit({
        userId: session.user.id,
        action: AuditAction.WEBHOOK_DLQ_PURGED,
        entity: "WebhookDeadLetter",
        data: { count },
      })
      return NextResponse.json({ success: true, message: "Dead letter queue purged" })
    }

    return apiError("validation", { message: "Invalid action" })
  },
)
