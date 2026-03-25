import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/database"
import { getTenantAccess } from "@/lib/tenant-access"

/**
 * GET /api/tenant/[tenant]/single-types/slug/[slug]
 * Get a single type by slug
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tenant: string; slug: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { tenant, slug } = await params

    const access = await getTenantAccess(session, tenant)
    if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    // Get single type by slug and tenant scope
    const singleType = await db.singleType.findFirst({
      where: { 
        slug,
        OR: [
          { tenantId: access.tenantId },
          { tenantId: null }
        ]
      },
      include: {
        fields: {
          orderBy: {
            order: 'asc',
          },
        },
        tenants: {
          where: { tenantId: access.tenantId }
        }
      },
    })

    if (!singleType) {
      return NextResponse.json({ error: "Single type not found" }, { status: 404 })
    }

    // Get the assignment/data for this tenant
    // Using findFirst to be safe if schema/DB unique keys are slightly different
    const assignment = await db.tenantSingleTypeAssignment.findFirst({
      where: {
        tenantId: access.tenantId,
        singleTypeId: singleType.id,
      },
    })

    // Parse options from JSON strings and data
    const singleTypeWithData = {
      ...singleType,
      isGlobal: singleType.tenants.length === 0,
      data: assignment?.data ? (typeof assignment.data === 'string' ? JSON.parse(assignment.data) : assignment.data) : {},
      publishedAt: assignment?.publishedAt || null,
      fields: singleType.fields.map((field: any) => ({
        ...field,
        options: field.options ? (typeof field.options === 'string' ? JSON.parse(field.options) : field.options) : undefined,
      })),
    }

    return NextResponse.json(singleTypeWithData)
  } catch (error) {
    console.error("Error fetching single type by slug:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/tenant/[tenant]/single-types/slug/[slug]
 * Update the CONTENT data of a single type for this tenant
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ tenant: string; slug: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { tenant, slug } = await params
    const access = await getTenantAccess(session, tenant)
    if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const body = await request.json()
    const { data, publish, locale = "en" } = body

    // Get single type to find its ID (scoped to tenant)
    const singleType = await db.singleType.findFirst({
      where: { 
        slug,
        OR: [
          { tenantId: access.tenantId },
          { tenantId: null }
        ]
      },
    })

    if (!singleType) {
      return NextResponse.json({ error: "Single type not found" }, { status: 404 })
    }

    // Update the tenant assignment data
    // We use upsert because the assignment record might not exist yet
    const assignment = await db.tenantSingleTypeAssignment.upsert({
      where: {
        tenantId_singleTypeId_locale: {
          tenantId: access.tenantId,
          singleTypeId: singleType.id,
          locale: locale || "en",
        }
      },
      update: {
        data: typeof data === 'string' ? data : JSON.stringify(data),
        publishedAt: publish ? new Date() : undefined,
      },
      create: {
        tenantId: access.tenantId,
        singleTypeId: singleType.id,
        locale: locale || "en",
        data: typeof data === 'string' ? data : JSON.stringify(data),
        publishedAt: publish ? new Date() : null,
      },
    })

    return NextResponse.json({ success: true, data: assignment.data })
  } catch (error) {
    console.error("Error updating single type content:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}