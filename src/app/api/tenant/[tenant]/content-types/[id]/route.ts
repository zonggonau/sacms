import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db, getTenantDb } from "@/lib/database"
import { getTenantAccess } from "@/lib/tenant-access"
import { validateBody } from "@/lib/validate"
import { updateContentTypeSchema } from "@/lib/validations"

/**
 * GET /api/tenant/[tenant]/content-types/[id]
 * Get a content type by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tenant: string; id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { tenant, id } = await params

    const access = await getTenantAccess(session, tenant)
    if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    // Use dynamic DB client
    const tenantDb = await getTenantDb(tenant)

    // Get content type
    const contentType = await tenantDb.contentType.findUnique({
      where: { id },
      include: {
        fields: {
          orderBy: { order: 'asc' },
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
 * PATCH /api/tenant/[tenant]/content-types/[id]
 * Update a content type
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ tenant: string; id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { tenant, id } = await params

    const access = await getTenantAccess(session, tenant)
    if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    if (access.role !== "admin" && access.role !== "owner") {
      return NextResponse.json(
        { error: "Only tenant admins and owners can update content types" },
        { status: 403 }
      )
    }

    const result = await validateBody(request, updateContentTypeSchema)
    if ("error" in result) return result.error
    const body = result.data
    const { name, description, fields } = body

    // Use dynamic DB client
    const tenantDb = await getTenantDb(tenant)

    // Check if content type exists
    const existingContentType = await tenantDb.contentType.findUnique({
      where: { id },
    })

    if (!existingContentType) {
      return NextResponse.json({ error: "Content type not found" }, { status: 404 })
    }

    // Delete existing fields first to avoid unique constraint collisions (contentTypeId, slug)
    // during the update transaction.
    await tenantDb.contentTypeField.deleteMany({
      where: { contentTypeId: id }
    })

    // Update content type
    const contentType = await tenantDb.contentType.update({
      where: { id },
      data: {
        name,
        description,
        fields: {
          create: fields?.map((field: Record<string, unknown>, index: number) => ({
            name: field.name as string,
            slug: field.slug as string,
            type: field.type as string,
            required: field.required as boolean || false,
            unique: field.unique as boolean || false,
            options: field.options as any,
            jsonPath: (field.jsonPath as string) || null,
            relationSlug: (field.relationSlug as string) || null,
            order: index,
          })) || [],
        },
      },
      include: {
        fields: true,
      },
    })

    return NextResponse.json({ contentType })
  } catch (error) {
    console.error("Error updating content type:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/tenant/[tenant]/content-types/[id]
 * Delete a content type
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ tenant: string; id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { tenant, id } = await params

    const access = await getTenantAccess(session, tenant)
    if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    if (access.role !== "admin" && access.role !== "owner") {
      return NextResponse.json(
        { error: "Only tenant admins and owners can delete content types" },
        { status: 403 }
      )
    }

    // Use dynamic DB client
    const tenantDb = await getTenantDb(tenant)

    // Check if content type exists
    const existingContentType = await tenantDb.contentType.findUnique({
      where: { id },
      include: {
        tenants: true,
      }
    })

    if (!existingContentType) {
      return NextResponse.json({ error: "Content type not found" }, { status: 404 })
    }

    // Check if it's a global content type or assigned to other tenants
    const isGlobal = existingContentType.tenantId === null
    const isOwnedByOther = existingContentType.tenantId !== null && existingContentType.tenantId !== access.tenantId

    if (isGlobal || isOwnedByOther) {
      return NextResponse.json(
        { error: "Global content types cannot be deleted by tenant admins" },
        { status: 403 }
      )
    }

    // Delete content type (this will cascade delete fields and related data)
    await tenantDb.contentType.delete({
      where: { id },
    })

    return NextResponse.json({ message: "Content type deleted successfully" })
  } catch (error) {
    console.error("Error deleting content type:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}