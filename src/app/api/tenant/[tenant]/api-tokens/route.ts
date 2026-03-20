import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/database"
import { randomBytes } from "crypto"
import { validateBody } from "@/lib/validate"
import { createApiTokenSchema } from "@/lib/validations"

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

    const { tenant: tenantSlug } = await params

    // Get tenant
    const tenant = await db.tenant.findUnique({
      where: { slug: tenantSlug },
    })

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 })
    }

    // Check access
    const membership = await db.tenantMember.findFirst({
      where: {
        tenantId: tenant.id,
        userId: session.user.id,
      },
    })

    const isSuperAdmin = session.user.role === "super_admin"
    if (!membership && !isSuperAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Get API tokens (without showing actual token value for security)
    const tokens = await db.apiToken.findMany({
      where: { tenantId: tenant.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
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

    // Mask tokens for display and ensure permissions is an array
    const safeTokens = tokens.map((t) => {
      let perms = t.permissions
      if (typeof t.permissions === 'string') {
        try { perms = JSON.parse(t.permissions) } catch { perms = [] }
      }
      return {
        ...t,
        token: t.token ? `${t.token.substring(0, 10)}...${"*".repeat(20)}` : null,
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

    const { tenant: tenantSlug } = await params

    // Get tenant
    const tenant = await db.tenant.findUnique({
      where: { slug: tenantSlug },
    })

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 })
    }

    // Check access
    const membership = await db.tenantMember.findFirst({
      where: {
        tenantId: tenant.id,
        userId: session.user.id,
      },
    })

    const isSuperAdmin = session.user.role === "super_admin"
    if (!membership && !isSuperAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const result = await validateBody(request, createApiTokenSchema)
    if ("error" in result) return result.error
    const { name, description, type, permissions, expiresAt } = result.data

    // Generate token
    const token = generateToken()
    
    // Create API token
    const apiToken = await db.apiToken.create({
      data: {
        tenantId: tenant.id,
        name: name as string,
        description: (description as string) || null,
        token,
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