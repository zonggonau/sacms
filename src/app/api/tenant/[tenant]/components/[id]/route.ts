import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/database"
import { getTenantAccess } from "@/lib/tenant-access"
import { validateBody } from "@/lib/validate"
import { updateComponentSchema } from "@/lib/validations"

/**
 * PATCH /api/tenant/[tenant]/components/[id]
 * Update a component
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
        { error: "Only tenant admins and owners can update components" },
        { status: 403 }
      )
    }

    const result = await validateBody(request, updateComponentSchema)
    if ("error" in result) return result.error
    const body = result.data
    const { name, slug, description, category, fields } = body

    // Check if component exists
    const existingComponent = await db.component.findUnique({
      where: { id },
    })

    if (!existingComponent) {
      return NextResponse.json({ error: "Component not found" }, { status: 404 })
    }

    // Check if new slug is already taken by another component
    if (slug !== existingComponent.slug) {
      const slugConflict = await db.component.findUnique({
        where: { slug },
      })

      if (slugConflict) {
        return NextResponse.json(
          { error: "A component with this slug already exists" },
          { status: 400 }
        )
      }
    }

    // Delete existing fields
    await db.componentField.deleteMany({
      where: { componentId: id },
    })

    // Update component and create new fields
    const updatedComponent = await db.component.update({
      where: { id },
      data: {
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
    const componentWithParsedOptions = {
      ...updatedComponent,
      fields: updatedComponent.fields.map((field: any) => ({
        ...field,
        options: field.options ? JSON.parse(field.options) : undefined,
      })),
    }

    return NextResponse.json({ component: componentWithParsedOptions })
  } catch (error) {
    console.error("Error updating component:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/tenant/[tenant]/components/[id]
 * Delete a component
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
        { error: "Only tenant admins and owners can delete components" },
        { status: 403 }
      )
    }

    // Check if component exists and its ownership
    const existingComponent = await db.component.findUnique({
      where: { id },
    })

    if (!existingComponent) {
      return NextResponse.json({ error: "Component not found" }, { status: 404 })
    }

    // Verify ownership
    const isGlobal = existingComponent.tenantId === null
    const isOwnedByOther = existingComponent.tenantId !== null && existingComponent.tenantId !== access.tenantId

    if (isGlobal || isOwnedByOther) {
      return NextResponse.json(
        { error: "Global or shared components cannot be deleted by tenant admins" },
        { status: 403 }
      )
    }

    // Delete component (cascade delete will handle fields and tenant assignments)
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