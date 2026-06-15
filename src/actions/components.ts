"use server"

import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { getTenantAccess } from "@/lib/tenant-access"
import { getTenantDb } from "@/lib/database"
import { checkPermission, PERMISSIONS } from "@/lib/rbac"
import { createComponentSchema, updateComponentSchema } from "@/lib/validations"
import { revalidatePath } from "next/cache"

export async function getComponentsAction(tenantSlug: string) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return { error: "Unauthorized" }

    const access = await getTenantAccess(session, tenantSlug)
    if (!access) return { error: "Forbidden" }

    const rbac = await checkPermission(tenantSlug, PERMISSIONS.CONTENT_TYPE_READ)
    if (!rbac.allowed) return { error: "Forbidden" }

    const tenantId = access.tenantId
    const tenantDb = await getTenantDb(tenantSlug)

    const components = await tenantDb.component.findMany({
      where: {
        OR: [
          { tenantId: tenantId },
          {
            tenants: {
              some: {
                tenantId: tenantId,
                enabled: true
              }
            }
          }
        ]
      },
      include: {
        fields: {
          orderBy: { order: 'asc' }
        },
      },
      orderBy: {
        name: 'asc',
      },
    })

    const componentsWithFlag = components.map(component => {
      const formattedFields = component.fields.map(field => {
        let parsedOptions = field.options
        if (typeof field.options === 'string') {
          try { parsedOptions = JSON.parse(field.options) } catch { parsedOptions = {} }
        }
        return { ...field, options: parsedOptions || {} }
      })

      return {
        ...component,
        fields: formattedFields,
        isGlobal: component.tenantId === null,
      }
    })

    return { components: componentsWithFlag }
  } catch (error) {
    console.error("Error fetching components:", error)
    return { error: "Internal server error" }
  }
}

export async function getComponentBySlugAction(tenantSlug: string, slug: string) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return { error: "Unauthorized" }

    const access = await getTenantAccess(session, tenantSlug)
    if (!access) return { error: "Forbidden" }

    const tenantDb = await getTenantDb(tenantSlug)

    const component = await tenantDb.component.findFirst({
      where: {
        slug,
        OR: [
          { tenantId: access.tenantId },
          { 
            tenantId: null,
            tenants: { some: { tenantId: access.tenantId, enabled: true } }
          }
        ]
      },
      include: {
        fields: {
          orderBy: { order: 'asc' },
        },
      },
    })

    if (!component) return { error: "Component not found" }

    const componentWithParsedOptions = {
      ...component,
      isGlobal: component.tenantId === null,
      fields: component.fields.map((field: any) => {
        let parsedOptions = field.options
        if (typeof field.options === 'string') {
          try { parsedOptions = JSON.parse(field.options) } catch { parsedOptions = {} }
        }
        return { ...field, options: parsedOptions || {} }
      }),
    }

    return { component: componentWithParsedOptions }
  } catch (error) {
    console.error("Error fetching component by slug:", error)
    return { error: "Internal server error" }
  }
}

export async function createComponentAction(tenantSlug: string, data: any) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return { error: "Unauthorized" }

    const access = await getTenantAccess(session, tenantSlug)
    if (!access) return { error: "Forbidden" }

    const rbac = await checkPermission(tenantSlug, PERMISSIONS.CONTENT_TYPE_CREATE)
    if (!rbac.allowed) return { error: "Forbidden" }

    const result = createComponentSchema.safeParse(data)
    if (!result.success) return { error: result.error.errors[0].message }
    const { name, slug, description, category, fields } = result.data

    const { enforcePlanLimit } = await import("@/lib/plan-enforcement")
    const enforcement = await enforcePlanLimit(access.tenantId, "content_types")
    if (!enforcement.allowed) return { error: enforcement.message }

    const tenantDb = await getTenantDb(tenantSlug)

    const existingComponent = await tenantDb.component.findFirst({
      where: { 
        slug,
        tenantId: access.tenantId
      },
    })

    if (existingComponent) return { error: "A component with this slug already exists" }

    const component = await tenantDb.component.create({
      data: {
        tenantId: access.tenantId,
        name,
        slug,
        description,
        category: category || "Other",
        fields: fields
          ? {
              create: fields.map((field: any, index: number) => ({
                name: field.name,
                slug: field.slug,
                type: field.type,
                required: field.required || false,
                unique: field.unique || false,
                options: field.options || {},
                jsonPath: field.jsonPath || null,
                relationSlug: field.relationSlug || null,
                order: index,
              })),
            }
          : undefined,
        tenants: {
          create: {
            tenantId: access.tenantId,
            enabled: true,
          },
        },
      },
      include: { fields: true },
    })

    revalidatePath(`/dashboard/${tenantSlug}/components`)
    return { component }
  } catch (error) {
    console.error("Error creating component:", error)
    return { error: "Internal server error" }
  }
}

export async function updateComponentAction(tenantSlug: string, id: string, data: any) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return { error: "Unauthorized" }

    const access = await getTenantAccess(session, tenantSlug)
    if (!access) return { error: "Forbidden" }

    const rbac = await checkPermission(tenantSlug, PERMISSIONS.CONTENT_TYPE_UPDATE)
    if (!rbac.allowed) return { error: "Forbidden" }

    const tenantDb = await getTenantDb(tenantSlug)

    const result = updateComponentSchema.safeParse(data)
    if (!result.success) return { error: result.error.errors[0].message }
    const { name, slug, description, category, fields } = result.data

    const existingComponent = await tenantDb.component.findUnique({
      where: { id },
    })

    if (!existingComponent) return { error: "Component not found" }

    if (slug && slug !== existingComponent.slug) {
      const slugConflict = await tenantDb.component.findFirst({
        where: { slug, tenantId: access.tenantId },
      })
      if (slugConflict) return { error: "A component with this slug already exists" }
    }

    const updatedComponent = await tenantDb.$transaction(async (tx) => {
      await tx.componentField.deleteMany({
        where: { componentId: id },
      })

      return await tx.component.update({
        where: { id },
        data: {
          name,
          slug,
          description,
          category,
          fields: fields
            ? {
                create: fields.map((field: any, index: number) => ({
                  name: field.name,
                  slug: field.slug,
                  type: field.type,
                  required: field.required || false,
                  unique: field.unique || false,
                  options: field.options || {},
                  jsonPath: field.jsonPath || null,
                  relationSlug: field.relationSlug || null,
                  order: index,
                })),
              }
            : undefined,
        },
        include: {
          fields: { orderBy: { order: 'asc' } },
        },
      })
    })

    revalidatePath(`/dashboard/${tenantSlug}/components`)
    return { component: updatedComponent }
  } catch (error) {
    console.error("Error updating component:", error)
    return { error: "Internal server error" }
  }
}

export async function deleteComponentAction(tenantSlug: string, id: string) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return { error: "Unauthorized" }

    const access = await getTenantAccess(session, tenantSlug)
    if (!access) return { error: "Forbidden" }

    const rbac = await checkPermission(tenantSlug, PERMISSIONS.CONTENT_TYPE_DELETE)
    if (!rbac.allowed) return { error: "Forbidden" }

    const tenantDb = await getTenantDb(tenantSlug)

    const existingComponent = await tenantDb.component.findUnique({
      where: { id },
    })

    if (!existingComponent) return { error: "Component not found" }

    const isGlobal = existingComponent.tenantId === null
    const isOwnedByOther = !isGlobal && existingComponent.tenantId !== access.tenantId

    if (isGlobal || isOwnedByOther) {
      return { error: "Global or shared components cannot be deleted by tenant admins" }
    }

    await tenantDb.component.delete({ where: { id } })

    revalidatePath(`/dashboard/${tenantSlug}/components`)
    return { success: true }
  } catch (error) {
    console.error("Error deleting component:", error)
    return { error: "Internal server error" }
  }
}
