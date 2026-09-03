import { NextResponse } from "next/server"
import { db } from "@/lib/database"
import { validateBody } from "@/lib/validate"
import { updateWebhookSchema } from "@/lib/validations"
import { withStaffAuth, apiError } from "@/lib/api/route-helpers"

/** GET /api/tenant/[tenant]/webhooks/[webhookId] — single webhook. */
export const GET = withStaffAuth(async (_request, context, { access }) => {
  const { webhookId } = await context.params
  const webhook = await db.webhook.findFirst({ where: { id: webhookId, tenantId: access.tenantId } })
  if (!webhook) return apiError("not_found", { message: "Webhook not found" })
  return NextResponse.json({ webhook })
})

/** PUT /api/tenant/[tenant]/webhooks/[webhookId] — update (admin/owner only). */
export const PUT = withStaffAuth(
  async (request, context, { access }) => {
    const { webhookId } = await context.params
    const webhook = await db.webhook.findFirst({ where: { id: webhookId, tenantId: access.tenantId } })
    if (!webhook) return apiError("not_found", { message: "Webhook not found" })

    const result = await validateBody(request, updateWebhookSchema)
    if ("error" in result) return result.error
    const { name, url, secret, events, enabled } = result.data
    const headers = (result.data as Record<string, unknown>).headers

    const updateData: Record<string, unknown> = {}
    if (name !== undefined) updateData.name = name
    if (url !== undefined) {
      try {
        new URL(url)
        updateData.url = url
      } catch {
        return apiError("validation", { message: "Invalid URL" })
      }
    }
    if (secret !== undefined) updateData.secret = secret || null
    if (events !== undefined) updateData.events = events
    if (enabled !== undefined) updateData.enabled = enabled
    if (headers !== undefined) updateData.headers = headers || null

    const updated = await db.webhook.update({ where: { id: webhookId }, data: updateData })
    return NextResponse.json({ webhook: updated })
  },
  { minRole: "admin" },
)

/** DELETE /api/tenant/[tenant]/webhooks/[webhookId] — delete (admin/owner only). */
export const DELETE = withStaffAuth(
  async (_request, context, { access }) => {
    const { webhookId } = await context.params
    const webhook = await db.webhook.findFirst({ where: { id: webhookId, tenantId: access.tenantId } })
    if (!webhook) return apiError("not_found", { message: "Webhook not found" })

    await db.webhookLog.deleteMany({ where: { webhookId } })
    await db.webhook.delete({ where: { id: webhookId } })
    return NextResponse.json({ success: true })
  },
  { minRole: "admin" },
)
