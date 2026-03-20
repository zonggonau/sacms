import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/database"
import { validateBody } from "@/lib/validate"
import { createComponentSchema } from "@/lib/validations"

// GET /api/admin/components - List all components
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user || session.user.role !== "super_admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const components = await db.component.findMany({
      include: {
        fields: {
          orderBy: { order: "asc" }
        },
        tenants: {
          include: {
            tenant: {
              select: { id: true, name: true, slug: true }
            }
          }
        },
        _count: {
          select: { tenants: true }
        }
      },
      orderBy: { createdAt: "desc" }
    })

    // Filter out tenant-specific components (only show global components)
    // Global components are those created by super admin
    // Tenant-specific components have exactly 1 tenant assignment (the creator)
    const globalComponents = components.filter(c => 
      c._count.tenants === 0 || c._count.tenants > 1
    )

    return NextResponse.json({ components: globalComponents })
  } catch (error) {
    console.error("Failed to fetch components:", error)
    return NextResponse.json(
      { error: "Failed to fetch components" },
      { status: 500 }
    )
  }
}

// POST /api/admin/components - Create a new component
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user || session.user.role !== "super_admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const result = await validateBody(request, createComponentSchema)
    if ("error" in result) return result.error
    const { name, slug, description, category, fields } = result.data

    // Check if slug already exists
    const existing = await db.component.findUnique({
      where: { slug }
    })

    if (existing) {
      return NextResponse.json(
        { error: "A component with this slug already exists" },
        { status: 400 }
      )
    }

    // Create component with fields
    const component = await db.component.create({
      data: {
        name,
        slug,
        description,
        category: category || "Other",
        fields: fields ? {
          create: fields.map((field: Record<string, unknown>, index: number) => ({
            name: field.name as string,
            slug: field.slug as string,
            type: field.type as string,
            required: (field.required as boolean) || false,
            unique: (field.unique as boolean) || false,
            options: field.options ? (typeof field.options === 'string' ? field.options : JSON.stringify(field.options)) : null,
            jsonPath: (field.jsonPath as string) || null,
            relationSlug: (field.relationSlug as string) || null,
            order: typeof field.order === 'number' ? field.order as number : index,
          }))
        } : undefined
      },
      include: {
        fields: true
      }
    })

    return NextResponse.json({ component })
  } catch (error) {
    console.error("Failed to create component:", error)
    return NextResponse.json(
      { error: "Failed to create component" },
      { status: 500 }
    )
  }
}