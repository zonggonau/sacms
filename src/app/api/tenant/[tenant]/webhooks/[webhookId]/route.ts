import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/database"
import { validateBody } from "@/lib/validate"
import { updateWebhookSchema } from "@/lib/validations"

type Params = {
  tenant: string
  webhookId: string
}

// GET /api/tenant/[tenant]/webhooks/[webhookId] - Get single webhook
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

    const webhook = await db.webhook.findFirst({
      where: { id: webhookId, tenantId: tenant.id },
    })

    if (!webhook) {
      return NextResponse.json({ error: "Webhook not found" }, { status: 404 })
    }

    return NextResponse.json({ webhook })
  } catch (error) {
    console.error("Error fetching webhook:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// PUT /api/tenant/[tenant]/webhooks/[webhookId] - Update webhook
export async function PUT(
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
      where: {
        tenantId: tenant.id,
        userId: session.user.id,
        role: { in: ["owner", "admin"] },
      },
    })

    const isSuperAdmin = session.user.role === "super_admin"
    if (!membership && !isSuperAdmin) {
      return NextResponse.json({ error: "Forbidden - Admin access required" }, { status: 403 })
    }

    const webhook = await db.webhook.findFirst({
      where: { id: webhookId, tenantId: tenant.id },
    })

    if (!webhook) {
      return NextResponse.json({ error: "Webhook not found" }, { status: 404 })
    }

    const result = await validateBody(request, updateWebhookSchema)
    if ("error" in result) return result.error
    const { name, url, secret, events, enabled } = result.data
    const headers = (result.data as Record<string, unknown>).headers

    // Build update data
    const updateData: any = {}
    
    if (name !== undefined) updateData.name = name
    if (url !== undefined) {
      try {
        new URL(url)
        updateData.url = url
      } catch {
        return NextResponse.json({ error: "Invalid URL" }, { status: 400 })
      }
    }
    if (secret !== undefined) updateData.secret = secret || null
    if (events !== undefined) updateData.events = events
    if (enabled !== undefined) updateData.enabled = enabled
    if (headers !== undefined) updateData.headers = headers || null

    const updated = await db.webhook.update({
      where: { id: webhookId },
      data: updateData,
    })

    return NextResponse.json({ webhook: updated })
  } catch (error) {
    console.error("Error updating webhook:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// DELETE /api/tenant/[tenant]/webhooks/[webhookId] - Delete webhook
export async function DELETE(
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
      where: {
        tenantId: tenant.id,
        userId: session.user.id,
        role: { in: ["owner", "admin"] },
      },
    })

    const isSuperAdmin = session.user.role === "super_admin"
    if (!membership && !isSuperAdmin) {
      return NextResponse.json({ error: "Forbidden - Admin access required" }, { status: 403 })
    }

    const webhook = await db.webhook.findFirst({
      where: { id: webhookId, tenantId: tenant.id },
    })

    if (!webhook) {
      return NextResponse.json({ error: "Webhook not found" }, { status: 404 })
    }

    // Delete logs first (cascade should handle this, but being explicit)
    await db.webhookLog.deleteMany({
      where: { webhookId },
    })

    await db.webhook.delete({
      where: { id: webhookId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting webhook:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
