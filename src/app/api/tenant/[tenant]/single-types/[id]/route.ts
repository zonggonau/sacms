import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getTenantDb } from "@/lib/database"
import { getTenantAccess } from "@/lib/tenant-access"
import { validateBody } from "@/lib/validate"
import { updateSingleTypeSchema } from "@/lib/validations"

/**
 * PATCH /api/tenant/[tenant]/single-types/[id]
 * Update a single type
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
        { error: "Only tenant admins and owners can update single types" },
        { status: 403 }
      )
    }

    const tenantDb = await getTenantDb(tenant)

    const result = await validateBody(request, updateSingleTypeSchema)
    if ("error" in result) return result.error
    const body = result.data
    const { name, slug, description, fields } = body

    // Check if single type exists
    const existingSingleType = await tenantDb.singleType.findUnique({
      where: { id },
    })

    if (!existingSingleType) {
      return NextResponse.json({ error: "Single type not found" }, { status: 404 })
    }

    // Check if new slug is already taken by another single type
    if (slug && slug !== existingSingleType.slug) {
      const slugConflict = await tenantDb.singleType.findUnique({
        where: { slug },
      })

      if (slugConflict) {
        return NextResponse.json(
          { error: "A single type with this slug already exists" },
          { status: 400 }
        )
      }
    }

    // Delete existing fields
    await tenantDb.singleTypeField.deleteMany({
      where: { singleTypeId: id },
    })

    // Update single type and create new fields
    const updatedSingleType = await tenantDb.singleType.update({
      where: { id },
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
      },
      include: {
        fields: {
          orderBy: {
            order: 'asc',
          },
        },
      },
    })

    // Parse options from JSON strings
    const singleTypeWithParsedOptions = {
      ...updatedSingleType,
      fields: updatedSingleType.fields.map((field: any) => ({
        ...field,
        options: field.options ? JSON.parse(field.options) : undefined,
      })),
    }

    return NextResponse.json({ singleType: singleTypeWithParsedOptions })
  } catch (error) {
    console.error("Error updating single type:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/tenant/[tenant]/single-types/[id]
 * Delete a single type
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
        { error: "Only tenant admins and owners can delete single types" },
        { status: 403 }
      )
    }

    const tenantDb = await getTenantDb(tenant)

    // Check if single type exists and its tenant assignments
    const existingSingleType = await tenantDb.singleType.findUnique({
      where: { id },
      include: {
        tenants: true,
      }
    })

    if (!existingSingleType) {
      return NextResponse.json({ error: "Single type not found" }, { status: 404 })
    }

    // Check if it's a global single type or assigned to other tenants
    const isGlobal = existingSingleType.tenants.length === 0 || existingSingleType.tenants.length > 1
    const isOwnedByOther = existingSingleType.tenants.length === 1 && existingSingleType.tenants[0].tenantId !== access.tenantId

    if (isGlobal || isOwnedByOther) {
      return NextResponse.json(
        { error: "Global single types cannot be deleted by tenant admins" },
        { status: 403 }
      )
    }

    // Delete single type (cascade delete will handle fields and tenant assignments)
    await tenantDb.singleType.delete({
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