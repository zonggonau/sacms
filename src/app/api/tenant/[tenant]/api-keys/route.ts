import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/database"
import { randomBytes } from "crypto"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tenant: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
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

    // Check admin access
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

    // Delete existing API keys to keep only one active (optional, based on requirement)
    // await db.apiKey.deleteMany({ where: { tenantId: tenant.id } })

    const newApiKey = `sacms_${randomBytes(24).toString("hex")}`
    const apiKeyRecord = await db.apiKey.create({
      data: {
        tenantId: tenant.id,
        name: "Default API Key",
        key: newApiKey,
        permissions: { fullAccess: true },
      },
    })

    return NextResponse.json({ apiKey: apiKeyRecord.key }, { status: 201 })
  } catch (error) {
    console.error("Error generating API key:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
