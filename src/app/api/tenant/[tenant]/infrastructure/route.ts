import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/database"
import { isEnterpriseTenant } from "@/lib/license"

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ tenant: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { tenant: tenantSlug } = await params

    const tenant = await db.tenant.findFirst({
      where: {
        OR: [{ slug: tenantSlug }, { id: tenantSlug }],
      },
    })

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 })
    }

    const membership = await db.tenantMember.findFirst({
      where: {
        tenantId: tenant.id,
        userId: session.user.id,
        role: { in: ["owner", "admin"] }
      },
    })

    const isSuperAdmin = session.user.role === "super_admin"
    if (!membership && !isSuperAdmin) {
      return NextResponse.json({ error: "Forbidden: Not an owner or admin" }, { status: 403 })
    }

    // Only Enterprise tenants can override infrastructure
    let isEnterprise = await isEnterpriseTenant("sacms-global", session.user.id)
    if (!isEnterprise) {
      isEnterprise = await isEnterpriseTenant(tenant.id, session.user.id)
    }

    if (!isEnterprise) {
      return NextResponse.json({ error: "Forbidden: Enterprise plan required" }, { status: 403 })
    }

    const data = await req.json()
    const { databaseUrl, storageConfig } = data

    await db.tenant.update({
      where: { id: tenant.id },
      data: {
        databaseUrl,
        storageConfig: storageConfig ? JSON.parse(JSON.stringify(storageConfig)) : null,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Failed to update tenant infrastructure:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
