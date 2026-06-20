import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/database"
import { processAutoSlugs } from "@/lib/slug"

/**
 * GET /api/admin/content-types/by-slug/[slug]/entries
 * Get all entries for a content type across all tenants
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (session.user.role !== "super_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { slug } = await params
    const searchParams = request.nextUrl.searchParams
    const tenantId = searchParams.get("tenantId")

    // Get content type
    const contentType = await db.contentType.findFirst({
      where: { 
        slug,
        tenantId: null 
      },
      select: { id: true, name: true, slug: true },
    })

    if (!contentType) {
      return NextResponse.json({ error: "Content type not found" }, { status: 404 })
    }

    // Get entries, optionally filtered by tenant
    const entries = await db.contentEntry.findMany({
      where: {
        contentTypeId: contentType.id,
        ...(tenantId && { tenantId }),
      },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return NextResponse.json({
      contentType,
      entries,
    })
  } catch (error) {
    console.error("Error fetching content type entries:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

/**
 * POST /api/admin/content-types/by-slug/[slug]/entries
 * Create a new entry for platform-level content (system tenant)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (session.user.role !== "super_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { slug } = await params
    const body = await request.json()
    const { data, status: entryStatus, locale, publish } = body

    if (!data) {
      return NextResponse.json({ error: "Data is required" }, { status: 400 })
    }

    // Get content type
    const contentType = await db.contentType.findFirst({
      where: { 
        slug,
        tenantId: null 
      },
      include: { schemaFields: true },
    })

    if (!contentType) {
      return NextResponse.json({ error: "Content type not found" }, { status: 404 })
    }

    // Process auto-generated slugs
    // We pass null for tenantId as these are global entries
    const dataWithSlugs = await processAutoSlugs(
      null, 
      contentType.id,
      contentType.schemaFields,
      typeof data === 'string' ? JSON.parse(data) : data
    )

    // Determine status and publication date
    const finalStatus = publish ? "PUBLISHED" : (entryStatus || "DRAFT")
    const publishedAt = finalStatus === "PUBLISHED" ? new Date() : null

    // Create the entry with optional tenantId (null for global)
    const entry = await db.contentEntry.create({
      data: {
        contentTypeId: contentType.id,
        tenantId: null, // Global/Platform level content
        locale: locale || "en",
        data: dataWithSlugs as any,
        status: finalStatus,
        publishedAt,
        createdBy: session.user.id,
        updatedBy: session.user.id,
      },
      include: {
        contentType: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    })

    return NextResponse.json({
      entry,
      contentType,
    })
  } catch (error) {
    console.error("Error creating content entry:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
