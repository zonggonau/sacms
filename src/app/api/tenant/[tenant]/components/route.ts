import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/database"
import { getTenantAccess } from "@/lib/tenant-access"
import { validateBody } from "@/lib/validate"
import { createComponentSchema } from "@/lib/validations"

/**
 * GET /api/tenant/[tenant]/components
 * Get all components available to tenant (global + tenant-specific)
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

    // Get all components available to this tenant:
    // 1. Global components (tenantId is null)
    // 2. Components owned by this tenant (tenantId matches)
    // 3. Components explicitly assigned to this tenant via TenantComponentAssignment
    const components = await db.component.findMany({
      where: {
        OR: [
          { tenantId: null },
          { tenantId: access.tenantId },
          {
            tenants: {
              some: {
                tenantId: access.tenantId
              }
            }
          }
        ]
      },
      include: {
        fields: {
          orderBy: { order: 'asc' }
        },
        tenants: true,
      },
      orderBy: {
        name: 'asc',
      },
    })

    // Add isGlobal flag to each component
    const componentsWithFlag = components.map(component => ({
      ...component,
      isGlobal: component.tenantId === null && component.tenants.length === 0,
    }))

    return NextResponse.json(componentsWithFlag)
  } catch (error) {
    console.error("Error fetching tenant components:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

/**
 * POST /api/tenant/[tenant]/components
 * Create a new component for a tenant (tenant-specific)
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
        { error: "Only tenant admins and owners can create components" },
        { status: 403 }
      )
    }

    const result = await validateBody(request, createComponentSchema)
    if ("error" in result) return result.error
    const { name, slug, description, category, fields } = result.data

    // Check if slug is already taken (globally or by this tenant)
    const existingComponent = await db.component.findUnique({
      where: { slug },
    })

    if (existingComponent) {
      return NextResponse.json(
        { error: "A component with this slug already exists" },
        { status: 400 }
      )
    }

    // Create tenant-specific component and assign it to tenant
    const component = await db.component.create({
      data: {
        tenantId: access.tenantId, // Set direct ownership
        name,
        slug,
        description,
        category: category || "Other",
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
          },
        },
      },
      include: {
        fields: true,
      },
    })

    return NextResponse.json({ component })
  } catch (error) {
    console.error("Error creating component:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}