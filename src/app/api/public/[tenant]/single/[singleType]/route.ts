import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/database"
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit"
import { resolveContentData } from "@/lib/content-resolver"

// Public API - Get single type content
// Requires API token in header: Authorization: Bearer <token>
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tenant: string; singleType: string }> }
) {
  try {
    const { tenant: tenantSlug, singleType: singleTypeSlug } = await params

    // Validate API token
    const authHeader = request.headers.get("authorization")
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Missing or invalid authorization header" },
        { status: 401 }
      )
    }

    const token = authHeader.replace("Bearer ", "")

    // Rate limit by token
    const rateLimitResult = await rateLimit(`public:${token}`, RATE_LIMITS.publicApi)
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Try again later." },
        { status: 429 }
      )
    }

    // Find the API token
    const apiToken = await db.apiToken.findUnique({
      where: { token },
      include: { tenant: true },
    })

    if (!apiToken) {
      return NextResponse.json({ error: "Invalid API token" }, { status: 401 })
    }

    // Verify tenant matches
    if (apiToken.tenant.slug !== tenantSlug) {
      return NextResponse.json({ error: "Token does not match tenant" }, { status: 403 })
    }

    // Check if token is expired
    if (apiToken.expiresAt && apiToken.expiresAt < new Date()) {
      return NextResponse.json({ error: "API token expired" }, { status: 401 })
    }

    // Get single type (prefer tenant-specific over global)
    const singleType = await db.singleType.findFirst({
      where: { 
        slug: singleTypeSlug,
        OR: [
          { tenantId: apiToken.tenantId },
          { tenantId: null }
        ]
      },
      orderBy: {
        tenantId: { sort: 'desc', nulls: 'last' }
      },
      include: {
        fields: { orderBy: { order: "asc" } },
      },
    })

    if (!singleType) {
      return NextResponse.json({ error: "Single type not found" }, { status: 404 })
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const locale = searchParams.get("locale") || "en"

    // Check if single type is assigned to tenant
    const assignment = await db.tenantSingleTypeAssignment.findUnique({
      where: {
        tenantId_singleTypeId_locale: {
          tenantId: apiToken.tenantId,
          singleTypeId: singleType.id,
          locale,
        },
      },
    })

    if (!assignment || !assignment.enabled) {
      return NextResponse.json(
        { error: "Single type not available for this tenant" },
        { status: 404 }
      )
    }

    // Update last used
    await db.apiToken.update({
      where: { id: apiToken.id },
      data: { lastUsedAt: new Date() },
    })

    // Return content
    let rawData: any = {}
    if (assignment.data) {
      rawData = typeof assignment.data === 'string' ? JSON.parse(assignment.data) : assignment.data
    }
    
    // Resolve dynamic data (Relations and Components)
    const resolvedData = await resolveContentData(
      apiToken.tenantId,
      rawData,
      singleType.fields
    )

    return NextResponse.json({
      data: {
        ...resolvedData,
        publishedAt: assignment.publishedAt,
        updatedAt: assignment.updatedAt,
      },
      meta: {
        singleType: {
          name: singleType.name,
          slug: singleType.slug,
        },
      },
    })
  } catch (error) {
    console.error("Error fetching single type:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

// PUT - Update single type content (requires write permission)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ tenant: string; singleType: string }> }
) {
  try {
    const { tenant: tenantSlug, singleType: singleTypeSlug } = await params

    // Validate API token
    const authHeader = request.headers.get("authorization")
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Missing or invalid authorization header" },
        { status: 401 }
      )
    }

    const token = authHeader.replace("Bearer ", "")

    // Find the API token
    const apiToken = await db.apiToken.findUnique({
      where: { token },
      include: { tenant: true },
    })

    if (!apiToken) {
      return NextResponse.json({ error: "Invalid API token" }, { status: 401 })
    }

    // Check if token has write access
    if (apiToken.type === "read-only") {
      return NextResponse.json({ error: "Token does not have write permission" }, { status: 403 })
    }

    // Verify tenant matches
    if (apiToken.tenant.slug !== tenantSlug) {
      return NextResponse.json({ error: "Token does not match tenant" }, { status: 403 })
    }

    // Get single type (prefer tenant-specific over global)
    const singleType = await db.singleType.findFirst({
      where: { 
        slug: singleTypeSlug,
        OR: [
          { tenantId: apiToken.tenantId },
          { tenantId: null }
        ]
      },
      orderBy: {
        tenantId: { sort: 'desc', nulls: 'last' }
      },
    })

    if (!singleType) {
      return NextResponse.json({ error: "Single type not found" }, { status: 404 })
    }

    // Check assignment
    const assignment = await db.tenantSingleTypeAssignment.findUnique({
      where: {
        tenantId_singleTypeId_locale: {
          tenantId: apiToken.tenantId,
          singleTypeId: singleType.id,
          locale: "en", // Default to en for PUT, or we could pass it in body
        },
      },
    })

    if (!assignment || !assignment.enabled) {
      return NextResponse.json(
        { error: "Single type not available for this tenant" },
        { status: 404 }
      )
    }

    // Get request body
    const body = await request.json()
    const { data, publish } = body

    // Update assignment
    const updated = await db.tenantSingleTypeAssignment.update({
      where: { id: assignment.id },
      data: {
        data: JSON.stringify(data),
        publishedAt: publish ? new Date() : assignment.publishedAt,
        updatedAt: new Date(),
      },
    })

    // Update token last used
    await db.apiToken.update({
      where: { id: apiToken.id },
      data: { lastUsedAt: new Date() },
    })

    return NextResponse.json({
      data: {
        ...data,
        publishedAt: updated.publishedAt,
        updatedAt: updated.updatedAt,
      },
    })
  } catch (error) {
    console.error("Error updating single type:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
