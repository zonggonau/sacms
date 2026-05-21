import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/database"
import { validateBody } from "@/lib/validate"
import { updateContentTypeSchema } from "@/lib/validations"
import { Prisma } from "@prisma/client"

/**
 * GET /api/admin/content-types/[id]
 * Get a single content type by ID
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

    const contentType = await db.contentType.findUnique({
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
        _count: {
          select: {
            entries: true,
          },
        },
      },
    })

    if (!contentType) {
      return NextResponse.json({ error: "Content type not found" }, { status: 404 })
    }

    return NextResponse.json(contentType)
  } catch (error) {
    console.error("Error fetching content type:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/admin/content-types/[id]
 * Update a content type
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
    const result = await validateBody(request, updateContentTypeSchema)
    if ("error" in result) return result.error
    const body = result.data

    // Check if content type exists
    const existing = await db.contentType.findUnique({
      where: { id },
    })

    if (!existing) {
      return NextResponse.json({ error: "Content type not found" }, { status: 404 })
    }

    // If slug is being changed, check if new slug is unique
    if (body.slug && body.slug !== existing.slug) {
      const slugExists = await db.contentType.findFirst({
        where: { slug: body.slug, tenantId: null },
      })

      if (slugExists) {
        return NextResponse.json(
          { error: "Slug already exists" },
          { status: 400 }
        )
      }
    }

    // Update content type
    const contentType = await db.contentType.update({
      where: { id },
      data: {
        ...(body.name && { name: body.name }),
        ...(body.slug && { slug: body.slug }),
        ...(body.description !== undefined && { description: body.description }),
        ...(body.isPublished !== undefined && { isPublished: body.isPublished }),
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
        _count: {
          select: {
            entries: true,
          },
        },
      },
    })

    // Handle fields update if provided
    if (body.fields !== undefined) {
      // Delete all existing fields
      await db.contentTypeField.deleteMany({
        where: { contentTypeId: id },
      })

      // Create new fields
      if (body.fields.length > 0) {
        await db.contentTypeField.createMany({
          data: body.fields.map((field: Record<string, unknown>, index: number) => ({
            contentTypeId: id,
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
      const updated = await db.contentType.findUnique({
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
          _count: {
            select: {
              entries: true,
            },
          },
        },
      })

      return NextResponse.json(updated)
    }

    return NextResponse.json(contentType)
  } catch (error) {
    console.error("Error updating content type:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/admin/content-types/[id]
 * Delete a content type
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

    // Check if content type exists
    const contentType = await db.contentType.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            entries: true,
            tenants: true,
          },
        },
      },
    })

    if (!contentType) {
      return NextResponse.json({ error: "Content type not found" }, { status: 404 })
    }

    // Check if content type has entries or tenants
    if (contentType._count.entries > 0) {
      return NextResponse.json(
        {
          error:
            "Cannot delete content type with existing entries. Please delete all entries first.",
        },
        { status: 400 }
      )
    }

    // Delete content type (cascade will delete fields and tenant assignments)
    await db.contentType.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting content type:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}