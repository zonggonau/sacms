import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db, getTenantDb } from "@/lib/database"
import { getTenantAccess } from "@/lib/tenant-access"
import { validateBody } from "@/lib/validate"
import { createContentTypeSchema } from "@/lib/validations"

/**
 * GET /api/tenant/[tenant]/content-types
 * Get all content types available to the tenant (global + tenant-specific)
 */
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

    const tenantId = access.tenantId
    // Use dynamic DB client (shared or dedicated)
    const tenantDb = await getTenantDb(tenantSlug)

    // Get content types owned by this tenant
    const availableContentTypes = await tenantDb.contentType.findMany({
      where: {
        OR: [
          { tenantId: tenantId },
          {
            tenants: {
              some: {
                tenantId: tenantId,
                enabled: true
              }
            }
          }
        ]
      },
      include: {
        fields: {
          orderBy: { order: "asc" },
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
    })

    // Get entry counts for each content type
    const contentTypesWithCounts = await Promise.all(
      availableContentTypes.map(async (contentType) => {
        const entryCount = await tenantDb.contentEntry.count({
          where: {
            contentTypeId: contentType.id,
            tenantId: tenantId,
          },
        })

        return {
          ...contentType,
          entryCount,
          isGlobal: false, // Since they are owned by the tenant
        }
      })
    )

    return NextResponse.json(contentTypesWithCounts)
  } catch (error) {
    console.error("Error fetching tenant content types:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

/**
 * POST /api/tenant/[tenant]/content-types
 * Create a new content type for a tenant (tenant-specific)
 */
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
    if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    if (access.role !== "admin" && access.role !== "owner") {
      return NextResponse.json(
        { error: "Only tenant admins and owners can create content types" },
        { status: 403 }
      )
    }

    const result = await validateBody(request, createContentTypeSchema)
    if ("error" in result) return result.error
    const { name, slug, description, fields } = result.data

    // Use dynamic DB client
    const tenantDb = await getTenantDb(tenantSlug)

    // Check if slug is already taken (in this tenant's DB)
    const existingContentType = await tenantDb.contentType.findUnique({
      where: { 
        tenantId_slug: {
          tenantId: access.tenantId,
          slug: slug
        }
      },
    })

    if (existingContentType) {
      return NextResponse.json(
        { error: "A content type with this slug already exists" },
        { status: 400 }
      )
    }

    // Create tenant-specific content type and assign it to the tenant
    const contentType = await tenantDb.contentType.create({
      data: {
        tenantId: access.tenantId, // Direct ownership
        name,
        slug,
        description,
        isPublished: true,
        fields: {
          create: fields
            ? fields.map((field: Record<string, unknown>, index: number) => ({
                name: field.name as string,
                slug: field.slug as string,
                type: field.type as string,
                required: field.required as boolean || false,
                unique: field.unique as boolean || false,
                options: field.options as any,
                jsonPath: (field.jsonPath as string) || null,
                relationSlug: (field.relationSlug as string) || null,
                order: index,
              }))
            : undefined,
        },
        tenants: {
          create: {
            tenantId: access.tenantId,
          },
        },
      },
      include: {
        fields: true,
      },
    })

    return NextResponse.json({ contentType })
  } catch (error) {
    console.error("Error creating content type:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}