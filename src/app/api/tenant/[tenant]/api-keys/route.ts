import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/database"
import { randomBytes } from "crypto"
import { getTenantAccess } from "@/lib/tenant-access"

// GET /api/tenant/[tenant]/api-keys — List all workspace API keys
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tenant: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { tenant: tenantSlug } = await params
    const access = await getTenantAccess(session, tenantSlug)

    if (!access) {
      return NextResponse.json({ error: "Forbidden or Tenant not found" }, { status: 403 })
    }

    const keys = await db.apiKey.findMany({
      where: { tenantId: access.tenantId },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json({
      apiKeys: keys.map((k) => ({
        id: k.id,
        name: k.name,
        key: k.key,
        createdAt: k.createdAt,
      })),
    })
  } catch (error: any) {
    console.error("Error fetching API keys:", error)
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}

// POST /api/tenant/[tenant]/api-keys — Create a new workspace API key
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
    const access = await getTenantAccess(session, tenantSlug)

    if (!access) {
      return NextResponse.json({ error: "Forbidden or Tenant not found" }, { status: 403 })
    }

    if (access.role !== "owner" && access.role !== "admin" && session.user.role !== "super_admin") {
      return NextResponse.json({ error: "Forbidden - Admin access required" }, { status: 403 })
    }

    const newApiKey = `sacms_${randomBytes(24).toString("hex")}`
    
    const existingKeys = await db.apiKey.findMany({
      where: { tenantId: access.tenantId }
    })

    let apiKeyRecord;

    if (existingKeys.length > 0) {
      const [firstKey, ...restKeys] = existingKeys;
      
      apiKeyRecord = await db.apiKey.update({
        where: { id: firstKey.id },
        data: {
          key: newApiKey,
          name: `API Key (${new Date().toLocaleDateString()})`,
        }
      })

      if (restKeys.length > 0) {
        await db.apiKey.deleteMany({
          where: {
            id: { in: restKeys.map(k => k.id) }
          }
        })
      }
    } else {
      apiKeyRecord = await db.apiKey.create({
        data: {
          tenantId: access.tenantId,
          name: `API Key (${new Date().toLocaleDateString()})`,
          key: newApiKey,
          permissions: { fullAccess: true },
        },
      })
    }

    return NextResponse.json({ apiKey: apiKeyRecord.key }, { status: 201 })
  } catch (error: any) {
    console.error("Error generating API key:", error)
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}
