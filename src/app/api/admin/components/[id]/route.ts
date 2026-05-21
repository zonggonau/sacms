import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/database"
import { validateBody } from "@/lib/validate"
import { updateComponentSchema } from "@/lib/validations"
import { Prisma } from "@prisma/client"

/**
 * GET /api/admin/components/[id]
 * Get a single component by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (session.user.role !== "super_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { id } = await params

    const component = await db.component.findUnique({
      where: { id },
      include: {
        fields: true,
        tenants: {
          include: {
            tenant: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
        },
      },
    })

    if (!component) {
      return NextResponse.json({ error: "Component not found" }, { status: 404 })
    }

    return NextResponse.json(component)
  } catch (error) {
    console.error("Error fetching component:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/admin/components/[id]
 * Update a component
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (session.user.role !== "super_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { id } = await params
    const result = await validateBody(request, updateComponentSchema)
    if ("error" in result) return result.error
    const body = result.data

    // Check if component exists
    const existing = await db.component.findUnique({
      where: { id },
    })

    if (!existing) {
      return NextResponse.json({ error: "Component not found" }, { status: 404 })
    }

    // If slug is being changed, check if new slug is unique
    if (body.slug && body.slug !== existing.slug) {
      const slugExists = await db.component.findFirst({
        where: { 
          slug: body.slug,
          tenantId: null 
        },
      })

      if (slugExists) {
        return NextResponse.json(
          { error: "Slug already exists" },
          { status: 400 }
        )
      }
    }

    // Update component (Note: Component doesn't have isPublished field in schema)
    const component = await db.component.update({
      where: { id },
      data: {
        ...(body.name && { name: body.name }),
        ...(body.slug && { slug: body.slug }),
        ...(body.description !== undefined && { description: body.description }),
        ...(body.category !== undefined && { category: body.category }),
      },
      include: {
        fields: true,
        tenants: {
          include: {
            tenant: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
        },
      },
    })

    // Handle fields update if provided
    if (body.fields !== undefined) {
      // Delete all existing fields
      await db.componentField.deleteMany({
        where: { componentId: id },
      })

      // Create new fields
      if (body.fields.length > 0) {
        await db.componentField.createMany({
          data: body.fields.map((field: Record<string, unknown>, index: number) => ({
            componentId: id,
            name: field.name as string,
            slug: (field.slug as string) || (field.name as string).toLowerCase().replace(/\s+/g, '-'),
            type: field.type as string,
            required: (field.required as boolean) || false,
            unique: (field.unique as boolean) || false,
            options: field.options ? (typeof field.options === 'string' ? field.options : JSON.stringify(field.options)) : Prisma.JsonNull,
            jsonPath: (field.jsonPath as string) || null,
            relationSlug: (field.relationSlug as string) || null,
            order: typeof field.order === 'number' ? field.order as number : index,
          })),
        })
      }

      // Refetch with updated fields
      const updated = await db.component.findUnique({
        where: { id },
        include: {
          fields: true,
          tenants: {
            include: {
              tenant: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                },
              },
            },
          },
        },
      })

      return NextResponse.json(updated)
    }

    return NextResponse.json(component)
  } catch (error) {
    console.error("Error updating component:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/admin/components/[id]
 * Delete a component
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (session.user.role !== "super_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { id } = await params

    // Check if component exists
    const component = await db.component.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            tenants: true,
          },
        },
      },
    })

    if (!component) {
      return NextResponse.json({ error: "Component not found" }, { status: 404 })
    }

    // Delete all tenant assignments first
    await db.tenantComponentAssignment.deleteMany({
      where: { componentId: id },
    })

    // Delete component (cascade will delete fields)
    await db.component.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting component:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}