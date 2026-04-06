import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/database"
import { validateBody } from "@/lib/validate"
import { updateSingleTypeSchema } from "@/lib/validations"

/**
 * GET /api/admin/single-types/[id]
 * Get a single single type by ID
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

    const singleType = await db.singleType.findUnique({
      where: { id },
      include: {
        fields: true,
      },
    })

    if (!singleType) {
      return NextResponse.json({ error: "Single type not found" }, { status: 404 })
    }

    return NextResponse.json(singleType)
  } catch (error) {
    console.error("Error fetching single type:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/admin/single-types/[id]
 * Update a single type
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
    const result = await validateBody(request, updateSingleTypeSchema)
    if ("error" in result) return result.error
    const body = result.data

    // Check if single type exists
    const existing = await db.singleType.findUnique({
      where: { id },
    })

    if (!existing) {
      return NextResponse.json({ error: "Single type not found" }, { status: 404 })
    }

    // If slug is being changed, check if new slug is unique
    if (body.slug && body.slug !== existing.slug) {
      const slugExists = await db.singleType.findFirst({
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

    // Update single type
    const singleType = await db.singleType.update({
      where: { id },
      data: {
        ...(body.name && { name: body.name }),
        ...(body.slug && { slug: body.slug }),
        ...(body.description !== undefined && { description: body.description }),
        ...(body.isPublished !== undefined && { isPublished: body.isPublished }),
      },
      include: {
        fields: true,
      },
    })

    // Handle fields update if provided
    if (body.fields !== undefined) {
      // Delete all existing fields
      await db.singleTypeField.deleteMany({
        where: { singleTypeId: id },
      })

      // Create new fields
      if (body.fields.length > 0) {
        await db.singleTypeField.createMany({
          data: body.fields.map((field: Record<string, unknown>, index: number) => ({
            singleTypeId: id,
            name: field.name as string,
            slug: (field.slug as string) || (field.name as string).toLowerCase().replace(/\s+/g, '-'),
            type: field.type as string,
            required: (field.required as boolean) || false,
            unique: (field.unique as boolean) || false,
            options: field.options ? (typeof field.options === 'string' ? field.options : JSON.stringify(field.options)) : null,
            jsonPath: (field.jsonPath as string) || null,
            relationSlug: (field.relationSlug as string) || null,
            order: typeof field.order === 'number' ? field.order as number : index,
          })),
        })
      }

      // Refetch with updated fields
      const updated = await db.singleType.findUnique({
        where: { id },
        include: {
          fields: true,
        },
      })

      return NextResponse.json(updated)
    }

    return NextResponse.json(singleType)
  } catch (error) {
    console.error("Error updating single type:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/admin/single-types/[id]
 * Delete a single type
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

    // Check if single type exists
    const singleType = await db.singleType.findUnique({
      where: { id },
    })

    if (!singleType) {
      return NextResponse.json({ error: "Single type not found" }, { status: 404 })
    }

    // Delete single type (cascade will delete fields)
    await db.singleType.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting single type:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}