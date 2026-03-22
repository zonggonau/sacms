import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/database"
import { getTenantAccess } from "@/lib/tenant-access"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tenant: string; webhookId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { tenant: tenantSlug, webhookId } = await params
    const access = await getTenantAccess(session, tenantSlug)
    if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    // Verify webhook belongs to tenant
    const webhook = await db.webhook.findFirst({
      where: { id: webhookId, tenantId: access.tenantId }
    })

    if (!webhook) {
      return NextResponse.json({ error: "Webhook not found" }, { status: 404 })
    }

    const logs = await db.webhookLog.findMany({
      where: { webhookId },
      orderBy: { createdAt: "desc" },
      take: 50 // Latest 50 logs
    })

    return NextResponse.json({ logs })
  } catch (error) {
    console.error("Webhook Logs API Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
