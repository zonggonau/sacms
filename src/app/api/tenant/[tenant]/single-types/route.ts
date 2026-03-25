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
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { tenant } = await params
    const access = await getTenantAccess(session, tenant)
    if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const isSuperAdmin = session.user.role === "super_admin"

    // Fetch Single Types owned by this tenant OR global templates
    const singleTypes = await db.singleType.findMany({
      where: {
        OR: [
          { tenantId: access.tenantId },
          { tenantId: null }
        ]
      },
      include: {
        fields: { orderBy: { order: 'asc' } },
        tenants: { where: { tenantId: access.tenantId } }
      },
      orderBy: { name: 'asc' }
    })

    // Map data from assignment table and deduplicate by slug
    const singleTypesMap = new Map()

    for (const st of singleTypes) {
      // Find assignment for this specific tenant (stores the content)
      const assignment = st.tenants[0] || await db.tenantSingleTypeAssignment.findFirst({
        where: { tenantId: access.tenantId, singleTypeId: st.id }
      })

      let parsedData = {}
      if (assignment?.data) {
        try {
          parsedData = typeof assignment.data === 'string' ? JSON.parse(assignment.data) : assignment.data
        } catch { parsedData = {} }
      }

      const mappedSt = {
        ...st,
        data: parsedData,
        publishedAt: assignment?.publishedAt || null,
        isGlobal: st.tenantId === null,
      }

      // If we don't have this slug yet, or the new one is tenant-specific (overriding global null)
      if (!singleTypesMap.has(st.slug) || st.tenantId !== null) {
        singleTypesMap.set(st.slug, mappedSt)
      }
    }

    return NextResponse.json(Array.from(singleTypesMap.values()))
  } catch (error) {
    console.error("Error fetching tenant single types:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * POST /api/tenant/[tenant]/single-types
 * Create a new single type owned by the tenant
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tenant: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { tenant } = await params
    const access = await getTenantAccess(session, tenant)
    if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    if (access.role !== "admin" && access.role !== "owner") {
      return NextResponse.json({ error: "Unauthorized role" }, { status: 403 })
    }

    const result = await validateBody(request, createSingleTypeSchema)
    if ("error" in result) return result.error
    const { name, slug, description, fields } = result.data

    // Check uniqueness within tenant scope
    const existing = await db.singleType.findFirst({
      where: { tenantId: access.tenantId, slug }
    })

    if (existing) {
      return NextResponse.json({ error: "Slug already exists in this workspace" }, { status: 400 })
    }

    // Create tenant-owned single type
    const singleType = await db.singleType.create({
      data: {
        tenantId: access.tenantId,
        name,
        slug,
        description,
        isPublished: true,
        fields: {
          create: fields?.map((field: any, index: number) => ({
            name: field.name,
            slug: field.slug,
            type: field.type,
            required: !!field.required,
            unique: !!field.unique,
            options: field.options ? JSON.stringify(field.options) : null,
            jsonPath: field.jsonPath || null,
            relationSlug: field.relationSlug || null,
            order: index,
          })) || [],
        },
        tenants: {
          create: {
            tenantId: access.tenantId,
            enabled: true,
          }
        }
      },
      include: { fields: true }
    })

    return NextResponse.json({ singleType })
  } catch (error) {
    console.error("Error creating single type:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
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