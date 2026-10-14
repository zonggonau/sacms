import { NextResponse } from "next/server"
import { db } from "@/lib/database"
import { validateBody } from "@/lib/validate"
import { createWebhookSchema } from "@/lib/validations"
import { withStaffAuth, apiError } from "@/lib/api/route-helpers"
import { assertPublicUrl, SsrfError } from "@/lib/safe-url"
import { logAudit, AuditAction } from "@/lib/audit-log"

/** Fields safe to return — never the signing `secret` (matches [webhookId]/route.ts). */
const WEBHOOK_SELECT = {
  id: true, name: true, url: true, events: true, enabled: true, headers: true,
  lastTriggeredAt: true, failureCount: true, createdAt: true, updatedAt: true,
} as const

/** GET /api/tenant/[tenant]/webhooks — list webhooks. */
export const GET = withStaffAuth(async (_request, _context, { access }) => {
  const webhooks = await db.webhook.findMany({
    where: { tenantId: access.tenantId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true, name: true, url: true, events: true, enabled: true,
      lastTriggeredAt: true, failureCount: true, createdAt: true,
    },
  })
  return NextResponse.json({ webhooks })
})

/** POST /api/tenant/[tenant]/webhooks — create a webhook (admin/owner only). */
export const POST = withStaffAuth(
  async (request, _context, { access, session }) => {
    const result = await validateBody(request, createWebhookSchema)
    if ("error" in result) return result.error
    const { name, url, secret, events, enabled } = result.data

    try {
      await assertPublicUrl(url)
    } catch (e) {
      return apiError("validation", {
        message: e instanceof SsrfError ? `Webhook URL rejected: ${e.message}` : "Invalid webhook URL",
      })
    }

    const webhook = await db.webhook.create({
      data: {
        tenantId: access.tenantId,
        name,
        url,
        secret: secret || null,
        events: events as any,
        enabled: enabled !== false,
      },
      // Never return the signing secret — the caller just set it and
      // already knows it; echoing it back here was the one place webhook
      // creation leaked it (every other webhook route already excludes it).
      select: WEBHOOK_SELECT,
    })

    logAudit({
      tenantId: access.tenantId,
      userId: session.user.id,
      action: AuditAction.WEBHOOK_CREATED,
      entity: "Webhook",
      entityId: webhook.id,
      data: { name: webhook.name, url: webhook.url, events: webhook.events, hasSecret: !!secret },
    })

    return NextResponse.json({ webhook })
  },
  { minRole: "admin" },
)
