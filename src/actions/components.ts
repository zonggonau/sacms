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

    const rbacContentType = await checkPermission(tenantSlug, PERMISSIONS.CONTENT_TYPE_READ)
    const rbacContent = await checkPermission(tenantSlug, PERMISSIONS.CONTENT_READ)
    if (!rbacContentType.allowed && !rbacContent.allowed) return { error: "Forbidden" }

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
        schemaFields: {
          orderBy: { order: 'asc' }
        },
      },
      orderBy: {
        name: 'asc',
      },
    })

    // Fetch all schema fields to calculate usage
    const allFields = await tenantDb.schemaField.findMany({
      where: {
        OR: [
          { contentType: { tenantId: tenantId } },
          { singleType: { tenantId: tenantId } },
          { component: { tenantId: tenantId } },
          { contentType: { tenantId: null } },
          { singleType: { tenantId: null } },
          { component: { tenantId: null } },
        ]
      }
    })

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
        isGlobal: component.tenantId === null,
        usedByCount,
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

    const rbacContentType = await checkPermission(tenantSlug, PERMISSIONS.CONTENT_TYPE_READ)
    const rbacContent = await checkPermission(tenantSlug, PERMISSIONS.CONTENT_READ)
    if (!rbacContentType.allowed && !rbacContent.allowed) return { error: "Forbidden" }

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
        schemaFields: {
          orderBy: { order: 'asc' },
        },
      },
    })

    if (!component) return { error: "Component not found" }

    const componentWithParsedOptions = {
      ...component,
      isGlobal: component.tenantId === null,
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
    if (!result.success) return { error: result.error.issues[0]?.message ?? "Validation failed" }
    const { name, slug, description, category, fields } = result.data

    const { enforcePlanLimit } = await import("@/lib/plan-enforcement")
    const enforcement = await enforcePlanLimit(access.tenantId, "content_types", session.user.id)
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
        schemaFields: fields
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
      include: { schemaFields: true },
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
    if (!result.success) return { error: result.error.issues[0]?.message ?? "Validation failed" }
    const { name, slug, description, category, fields } = result.data

    const existingComponent = await tenantDb.component.findUnique({
      where: { id },
    })

    if (!existingComponent) return { error: "Component not found" }

    const isGlobal = existingComponent.tenantId === null
    const isOwnedByOther = existingComponent.tenantId !== null && existingComponent.tenantId !== access.tenantId

    if (isGlobal || isOwnedByOther) {
      return { error: "Global or cross-tenant components cannot be modified by tenant admins" }
    }

    if (slug && slug !== existingComponent.slug) {
      const slugConflict = await tenantDb.component.findFirst({
        where: { slug, tenantId: access.tenantId },
      })
      if (slugConflict) return { error: "A component with this slug already exists" }
    }

    const updatedComponent = await tenantDb.$transaction(async (tx) => {
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
                  options: field.options || {},
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

    revalidatePath(`/dashboard/${tenantSlug}/components`)
    
    // Format response to match UI expectations
    const formattedFields = updatedComponent.schemaFields.map(field => {
      let parsedOptions = field.options
      if (typeof field.options === 'string') {
        try { parsedOptions = JSON.parse(field.options) } catch { parsedOptions = {} }
      }
      return { ...field, options: parsedOptions || {} }
    })

    return { component: { ...updatedComponent, fields: formattedFields } }
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

    const allFields = await tenantDb.schemaField.findMany({
      where: {
        OR: [
          { contentType: { tenantId: tenantId } },
          { singleType: { tenantId: tenantId } },
          { component: { tenantId: tenantId } },
          { contentType: { tenantId: null } },
          { singleType: { tenantId: null } },
          { component: { tenantId: null } },
        ],
      },
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

    await tenantDb.component.delete({ where: { id } })

    revalidatePath(`/dashboard/${tenantSlug}/components`)
    return { success: true }
  } catch (error) {
    console.error("Error deleting component:", error)
    return { error: "Internal server error" }
  }
}
