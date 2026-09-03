import { NextResponse } from "next/server"
import { db } from "@/lib/database"
import { withStaffAuth, apiError } from "@/lib/api/route-helpers"

export const GET = withStaffAuth(async (_request, context, { access }) => {
  const { webhookId } = await context.params
  const webhook = await db.webhook.findFirst({ where: { id: webhookId, tenantId: access.tenantId } })
  if (!webhook) return apiError("not_found", { message: "Webhook not found" })

  const logs = await db.webhookLog.findMany({
    where: { webhookId },
    orderBy: { createdAt: "desc" },
    take: 50,
  })
  return NextResponse.json({ logs })
})
