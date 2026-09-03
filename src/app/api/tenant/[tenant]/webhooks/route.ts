import { NextResponse } from "next/server"
import { db } from "@/lib/database"
import { validateBody } from "@/lib/validate"
import { createWebhookSchema } from "@/lib/validations"
import { withStaffAuth } from "@/lib/api/route-helpers"

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
  async (request, _context, { access }) => {
    const result = await validateBody(request, createWebhookSchema)
    if ("error" in result) return result.error
    const { name, url, secret, events, enabled } = result.data

    const webhook = await db.webhook.create({
      data: {
        tenantId: access.tenantId,
        name,
        url,
        secret: secret || null,
        events: events as any,
        enabled: enabled !== false,
      },
    })
    return NextResponse.json({ webhook })
  },
  { minRole: "admin" },
)
