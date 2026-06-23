"use server"

import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/database"
import { createComponentSchema, updateComponentSchema } from "@/lib/validations/admin"
import { revalidatePath } from "next/cache"
import { Prisma } from "@prisma/client"

export async function getAdminComponentsAction() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || session.user.role !== "super_admin") return { error: "Unauthorized" }

    const components = await db.component.findMany({
      where: {
        tenantId: null
      },
      include: {
        schemaFields: {
          orderBy: { order: 'asc' }
        },
      },
      orderBy: {
        name: 'asc',
      },
    })

    // Fetch all schema fields to calculate usage
    const allFields = await db.schemaField.findMany()

    const componentsWithFlag = components.map(component => {
      const formattedFields = component.schemaFields.map(field => {
        let parsedOptions = field.options
        if (typeof field.options === 'string') {
          try { parsedOptions = JSON.parse(field.options) } catch { parsedOptions = {} }
        }
        return { ...field, options: parsedOptions || {} }
      })

      // Calculate usedByCount
      const usedByCount = allFields.filter(f => {
        if (!f.options) return false;
        let opts: any = f.options;
        if (typeof opts === 'string') {
          try { opts = JSON.parse(opts); } catch { return false; }
        }
        return opts.componentSlug === component.slug;
      }).length;

      return {
        ...component,
        fields: formattedFields,
        isGlobal: true,
        usedByCount,
      }
    })

    return { components: componentsWithFlag }
  } catch (error) {
    console.error("Error fetching admin components:", error)
    return { error: "Internal server error" }
  }
}

export async function getAdminComponentBySlugAction(slug: string) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || session.user.role !== "super_admin") return { error: "Unauthorized" }

    const component = await db.component.findFirst({
      where: {
        slug,
        tenantId: null
      },
      include: {
        schemaFields: {
          orderBy: { order: 'asc' },
        },
      },
    })

    if (!component) return { error: "Component not found" }

    const componentWithParsedOptions = {
      ...component,
      isGlobal: true,
      fields: component.schemaFields.map((field: any) => {
        let parsedOptions = field.options
        if (typeof field.options === 'string') {
          try { parsedOptions = JSON.parse(field.options) } catch { parsedOptions = {} }
        }
        return { ...field, options: parsedOptions || {} }
      }),
    }

    return { component: componentWithParsedOptions }
  } catch (error) {
    console.error("Error fetching admin component by slug:", error)
    return { error: "Internal server error" }
  }
}

export async function createAdminComponentAction(data: any) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || session.user.role !== "super_admin") return { error: "Unauthorized" }

    const result = createComponentSchema.safeParse(data)
    if (!result.success) return { error: result.error.issues[0]?.message ?? "Validation failed" }
    const { name, slug, description, category, fields } = result.data

    const existingComponent = await db.component.findFirst({
      where: { 
        slug,
        tenantId: null
      },
    })

    if (existingComponent) return { error: "A global component with this slug already exists" }

    const component = await db.component.create({
      data: {
        tenantId: null,
        name,
        slug,
        description,
        category: category || "Other",
        schemaFields: fields
          ? {
              create: fields.map((field: any, index: number) => ({
                name: field.name,
                slug: field.slug,
                type: field.type,
                required: field.required || false,
                unique: field.unique || false,
                options: field.options || Prisma.JsonNull,
                jsonPath: field.jsonPath || null,
                relationSlug: field.relationSlug || null,
                order: index,
              })),
            }
          : undefined,
      },
      include: { schemaFields: true },
    })

    revalidatePath(`/admin/components`)
    return { component }
  } catch (error) {
    console.error("Error creating admin component:", error)
    return { error: "Internal server error" }
  }
}

export async function updateAdminComponentAction(id: string, data: any) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || session.user.role !== "super_admin") return { error: "Unauthorized" }

    const result = updateComponentSchema.safeParse(data)
    if (!result.success) return { error: result.error.issues[0]?.message ?? "Validation failed" }
    const { name, slug, description, category, fields } = result.data

    const existingComponent = await db.component.findUnique({
      where: { id },
    })

    if (!existingComponent || existingComponent.tenantId !== null) return { error: "Global component not found" }

    if (slug && slug !== existingComponent.slug) {
      const slugConflict = await db.component.findFirst({
        where: { slug, tenantId: null },
      })
      if (slugConflict) return { error: "A global component with this slug already exists" }
    }

    const updatedComponent = await db.$transaction(async (tx) => {
      await tx.schemaField.deleteMany({
        where: { componentId: id },
      })

      return await tx.component.update({
        where: { id },
        data: {
          name,
          slug,
          description,
          category,
          schemaFields: fields
            ? {
                create: fields.map((field: any, index: number) => ({
                  name: field.name,
                  slug: field.slug,
                  type: field.type,
                  required: field.required || false,
                  unique: field.unique || false,
                  options: field.options || Prisma.JsonNull,
                  jsonPath: field.jsonPath || null,
                  relationSlug: field.relationSlug || null,
                  order: index,
                })),
              }
            : undefined,
        },
        include: {
          schemaFields: { orderBy: { order: 'asc' } },
        },
      })
    })

    revalidatePath(`/admin/components`)
    
    const formattedFields = updatedComponent.schemaFields.map(field => {
      let parsedOptions = field.options
      if (typeof field.options === 'string') {
        try { parsedOptions = JSON.parse(field.options) } catch { parsedOptions = {} }
      }
      return { ...field, options: parsedOptions || {} }
    })

    return { component: { ...updatedComponent, fields: formattedFields } }
  } catch (error) {
    console.error("Error updating admin component:", error)
    return { error: "Internal server error" }
  }
}

export async function deleteAdminComponentAction(id: string) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || session.user.role !== "super_admin") return { error: "Unauthorized" }

    const existingComponent = await db.component.findUnique({
      where: { id },
    })

    if (!existingComponent || existingComponent.tenantId !== null) return { error: "Global component not found" }

    const allFields = await db.schemaField.findMany({
      select: { options: true },
    })

    const usedByCount = allFields.filter(field => {
      if (!field.options) return false
      let parsedOptions: any = field.options
      if (typeof parsedOptions === "string") {
        try {
          parsedOptions = JSON.parse(parsedOptions)
        } catch {
          return false
        }
      }
      return parsedOptions.componentSlug === existingComponent.slug
    }).length

    if (usedByCount > 0) {
      return {
        error: `Component is still used by ${usedByCount} schema field${usedByCount === 1 ? "" : "s"} and cannot be deleted.`,
      }
    }

    await db.component.delete({ where: { id } })

    revalidatePath(`/admin/components`)
    return { success: true }
  } catch (error) {
    console.error("Error deleting admin component:", error)
    return { error: "Internal server error" }
  }
}
