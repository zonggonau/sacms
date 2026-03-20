import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/database"

type Params = {
  tenant: string
  webhookId: string
}

// GET /api/tenant/[tenant]/webhooks/[webhookId]/logs - Get webhook logs
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<Params> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { tenant: tenantSlug, webhookId } = await params

    const tenant = await db.tenant.findUnique({ where: { slug: tenantSlug } })
    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 })
    }

    const membership = await db.tenantMember.findFirst({
      where: { tenantId: tenant.id, userId: session.user.id },
    })

    const isSuperAdmin = session.user.role === "super_admin"
    if (!membership && !isSuperAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Verify webhook belongs to tenant
    const webhook = await db.webhook.findFirst({
      where: { id: webhookId, tenantId: tenant.id },
    })

    if (!webhook) {
      return NextResponse.json({ error: "Webhook not found" }, { status: 404 })
    }

    // Get logs
    const logs = await db.webhookLog.findMany({
      where: { webhookId },
      orderBy: { createdAt: "desc" },
      take: 50,
    })

    return NextResponse.json({ logs })
  } catch (error) {
    console.error("Error fetching webhook logs:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
