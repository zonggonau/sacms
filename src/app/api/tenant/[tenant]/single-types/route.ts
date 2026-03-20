import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/database"
import { getTenantAccess } from "@/lib/tenant-access"
import { validateBody } from "@/lib/validate"
import { createSingleTypeSchema } from "@/lib/validations"
import { saveSingleTypeDataSchema } from "@/lib/validations"

/**
 * GET /api/tenant/[tenant]/single-types
 * Get all single types available to tenant (global + tenant-specific)
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

    const { tenant } = await params

    const access = await getTenantAccess(session, tenant)
    if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const isSuperAdmin = session.user.role === "super_admin"

    // Get all single types with their tenant assignments
    const singleTypes = await db.singleType.findMany({
      include: {
        fields: true,
        tenants: true,
      },
    })

    // Filter: Only show published global single types or those explicitly assigned to this tenant
    const availableSingleTypes = singleTypes.filter(st => {
      const isGlobal = st.tenants.length === 0
      if (isGlobal) {
        // Global single types only visible if published (non-super_admin) or if user is super_admin
        return isSuperAdmin || st.isPublished === true
      }
      
      // Tenant-specific single types: visible if assigned to this tenant
      return st.tenants.some(t => t.tenantId === access.tenantId && t.enabled)
    })

    // Get data for each single type (if exists for this tenant)
    const singleTypesWithData = await Promise.all(
      availableSingleTypes.map(async (singleType) => {
        const assignment = await db.tenantSingleTypeAssignment.findFirst({
          where: {
            tenantId: access.tenantId,
            singleTypeId: singleType.id,
          },
        })

        return {
          ...singleType,
          data: assignment?.data ? JSON.parse(assignment.data) : null,
          publishedAt: assignment?.publishedAt || null,
          isGlobal: singleType.tenants.length === 0,
        }
      })
    )

    return NextResponse.json(singleTypesWithData)
  } catch (error) {
    console.error("Error fetching tenant single types:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

/**
 * POST /api/tenant/[tenant]/single-types
 * Create a new single type for a tenant (tenant-specific)
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

    const { tenant } = await params

    const access = await getTenantAccess(session, tenant)
    if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    if (access.role !== "admin" && access.role !== "owner") {
      return NextResponse.json(
        { error: "Only tenant admins and owners can create single types" },
        { status: 403 }
      )
    }

    const result = await validateBody(request, createSingleTypeSchema)
    if ("error" in result) return result.error
    const { name, slug, description, fields } = result.data

    // Check if slug is already taken (globally or by this tenant)
    const existingSingleType = await db.singleType.findUnique({
      where: { slug },
    })

    if (existingSingleType) {
      return NextResponse.json(
        { error: "A single type with this slug already exists" },
        { status: 400 }
      )
    }

    // Create tenant-specific single type and assign it to tenant
    const singleType = await db.singleType.create({
      data: {
        name,
        slug,
        description,
        fields: fields
          ? {
              create: fields.map((field: Record<string, unknown>, index: number) => ({
                name: field.name as string,
                slug: field.slug as string,
                type: field.type as string,
                required: field.required as boolean || false,
                unique: (field.unique as boolean) || false,
                options: field.options ? JSON.stringify(field.options) : null,
                jsonPath: (field.jsonPath as string) || null,
                relationSlug: (field.relationSlug as string) || null,
                order: index,
              })),
            }
          : undefined,
        tenants: {
          create: {
            tenantId: access.tenantId,
            enabled: true,
          },
        },
      },
      include: {
        fields: true,
      },
    })

    return NextResponse.json({ singleType })
  } catch (error) {
    console.error("Error creating single type:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/tenant/[tenant]/single-types
 * Update single type data for this tenant
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ tenant: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { tenant } = await params
    const result = await validateBody(request, saveSingleTypeDataSchema)
    if ("error" in result) return result.error
    const { singleTypeId, data, publish } = result.data

    if (!singleTypeId) {
      return NextResponse.json({ error: "singleTypeId is required" }, { status: 400 })
    }

    const access = await getTenantAccess(session, tenant)
    if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    // Find or create assignment for this tenant
    const existingAssignment = await db.tenantSingleTypeAssignment.findFirst({
      where: {
        tenantId: access.tenantId,
        singleTypeId,
      },
      include: {
        singleType: true,
      },
    })

    let assignment
    if (!existingAssignment) {
      // Create assignment if it doesn't exist
      assignment = await db.tenantSingleTypeAssignment.create({
        data: {
          tenantId: access.tenantId,
          singleTypeId,
          enabled: true,
          data: data ? JSON.stringify(data) : null,
          publishedAt: publish ? new Date() : null,
        },
        include: {
          singleType: true,
        },
      })
    } else {
      // Update existing assignment
      assignment = await db.tenantSingleTypeAssignment.update({
        where: { id: existingAssignment.id },
        data: {
          data: data ? JSON.stringify(data) : undefined,
          publishedAt: publish ? new Date() : undefined,
        },
        include: {
          singleType: true,
        },
      })
    }

    return NextResponse.json({
      ...assignment.singleType,
      data: assignment.data ? JSON.parse(assignment.data) : null,
      publishedAt: assignment.publishedAt,
    })
  } catch (error) {
    console.error("Error updating tenant single type:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}