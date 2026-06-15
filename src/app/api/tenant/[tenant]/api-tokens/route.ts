import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/database"
import { randomBytes, createHash } from "crypto"
import { validateBody } from "@/lib/validate"
import { createApiTokenSchema } from "@/lib/validations"
import { getTenantAccess } from "@/lib/tenant-access"

// Generate a secure random token
function generateToken(): string {
  return `cf_${randomBytes(32).toString("hex")}`
}

// GET - List all API tokens for tenant
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tenant: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { tenant: tenantIdOrSlug } = await params
    const access = await getTenantAccess(session, tenantIdOrSlug)

    if (!access) {
      return NextResponse.json({ error: "Forbidden or Tenant not found" }, { status: 403 })
    }

    const tenantId = access.tenantId

    // Get API tokens (without showing actual token value for security)
    const tokens = await db.apiToken.findMany({
      where: { tenantId: tenantId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        tenantId: true,
        name: true,
        description: true,
        type: true,
        permissions: true,
        lastUsedAt: true,
        expiresAt: true,
        createdAt: true,
        token: true,
      },
    })

    // Mask tokens for display (only for non-admins or based on preference)
    // For now, let's keep them full for the developer explorer to work easily
    const safeTokens = tokens.map((t) => {
      let perms = t.permissions
      if (typeof t.permissions === 'string') {
        try { perms = JSON.parse(t.permissions) } catch { perms = [] }
      }
      return {
        ...t,
        permissions: Array.isArray(perms) ? perms : [],
      }
    })

    return NextResponse.json({ tokens: safeTokens })
  } catch (error) {
    console.error("Error fetching API tokens:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

// POST - Create new API token
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tenant: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { tenant: tenantIdOrSlug } = await params
    const access = await getTenantAccess(session, tenantIdOrSlug)

    if (!access) {
      return NextResponse.json({ error: "Forbidden or Tenant not found" }, { status: 403 })
    }

    if (access.role !== "admin" && access.role !== "owner") {
      return NextResponse.json(
        { error: "Only tenant admins and owners can create API tokens" },
        { status: 403 }
      )
    }

    const tenantId = access.tenantId

    const result = await validateBody(request, createApiTokenSchema)
    if ("error" in result) return result.error
    const { name, description, type, permissions, expiresAt } = result.data

    // Generate token
    const token = generateToken()
    const hashedToken = createHash("sha256").update(token).digest("hex")
    
    // Create API token
    const apiToken = await db.apiToken.create({
      data: {
        tenantId: tenantId,
        name: name as string,
        description: (description as string) || null,
        token: hashedToken,
        type: (type as string) || "read-only",
        permissions: permissions as any,
        expiresAt: expiresAt ? new Date(expiresAt as string | number | Date) : null,
        createdBy: session.user.id,
      },
    })
    
    // Return token (only shown once!)
    return NextResponse.json({ 
      token: {
        ...apiToken,
        permissions: Array.isArray(apiToken.permissions) ? apiToken.permissions : []
      },
      plainToken: token  // Show the full token only on creation
    })
  } catch (error) {
    console.error("Error creating API token:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}