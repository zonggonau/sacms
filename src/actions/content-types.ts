"use server"

import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { getTenantAccess } from "@/lib/tenant-access"
import { getTenantDb } from "@/lib/database"
import { checkPermission, PERMISSIONS } from "@/lib/rbac"
import { createContentTypeSchema, updateContentTypeSchema } from "@/lib/validations/admin"
import { revalidatePath } from "next/cache"

export async function getContentTypesAction(tenantSlug: string) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return { error: "Unauthorized" }

    const access = await getTenantAccess(session, tenantSlug)
    if (!access) return { error: "Forbidden" }

    const rbac = await checkPermission(tenantSlug, PERMISSIONS.CONTENT_TYPE_READ)
    if (!rbac.allowed) return { error: "Forbidden" }

    const tenantDb = await getTenantDb(tenantSlug)

    const availableContentTypes = await tenantDb.contentType.findMany({
      where: {
        OR: [
          { tenantId: access.tenantId },
          {
            tenants: {
              some: {
                tenantId: access.tenantId,
                enabled: true
              }
            }
          }
        ]
      },
      include: {
        fields: {
          orderBy: { order: "asc" },
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
    })

    const contentTypesWithCounts = await Promise.all(
      availableContentTypes.map(async (contentType) => {
        const entryCount = await tenantDb.contentEntry.count({
          where: {
            contentTypeId: contentType.id,
            tenantId: access.tenantId,
          },
        })

        const formattedFields = contentType.fields.map(field => {
          let parsedOptions = field.options
          if (typeof field.options === 'string') {
            try {
              parsedOptions = JSON.parse(field.options)
            } catch (e) {
              parsedOptions = {}
            }
          }
          return {
            ...field,
            options: parsedOptions || {}
          }
        })

        return {
          ...contentType,
          fields: formattedFields,
          entryCount,
          isGlobal: contentType.tenantId === null,
        }
      })
    )

    return { contentTypes: contentTypesWithCounts }
  } catch (error) {
    console.error("Error fetching content types:", error)
    return { error: "Internal server error" }
  }
}

export async function getContentTypeAction(tenantSlug: string, id: string) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return { error: "Unauthorized" }

    const access = await getTenantAccess(session, tenantSlug)
    if (!access) return { error: "Forbidden" }

    const rbac = await checkPermission(tenantSlug, PERMISSIONS.CONTENT_TYPE_READ)
    if (!rbac.allowed) return { error: "Forbidden" }

    const tenantDb = await getTenantDb(tenantSlug)

    const contentType = await tenantDb.contentType.findFirst({
      where: {
        id,
        OR: [
          { tenantId: access.tenantId },
          {
            tenants: {
              some: {
                tenantId: access.tenantId,
                enabled: true
              }
            }
          }
        ]
      },
      include: {
        fields: {
          orderBy: { order: 'asc' },
        },
      },
    })

    if (!contentType) return { error: "Content type not found" }

    const formattedFields = contentType.fields.map(field => {
      let parsedOptions = field.options
      if (typeof field.options === 'string') {
        try { parsedOptions = JSON.parse(field.options) } catch { parsedOptions = {} }
      }
      return { ...field, options: parsedOptions || {} }
    })

    return { contentType: { ...contentType, fields: formattedFields } }
  } catch (error) {
    console.error("Error fetching content type:", error)
    return { error: "Internal server error" }
  }
}

export async function getContentTypeBySlugAction(tenantSlug: string, slug: string) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return { error: "Unauthorized" }

    const access = await getTenantAccess(session, tenantSlug)
    if (!access) return { error: "Forbidden" }

    const rbac = await checkPermission(tenantSlug, PERMISSIONS.CONTENT_TYPE_READ)
    if (!rbac.allowed) return { error: "Forbidden" }

    const tenantDb = await getTenantDb(tenantSlug)

    const contentType = await tenantDb.contentType.findFirst({
      where: {
        slug,
        OR: [
          { tenantId: access.tenantId },
          {
            tenants: {
              some: {
                tenantId: access.tenantId,
                enabled: true
              }
            }
          }
        ]
      },
      include: {
        fields: {
          orderBy: { order: 'asc' },
        },
      },
    })

    if (!contentType) return { error: "Content type not found" }

    const formattedFields = contentType.fields.map(field => {
      let parsedOptions = field.options
      if (typeof field.options === 'string') {
        try { parsedOptions = JSON.parse(field.options) } catch { parsedOptions = {} }
      }
      return { ...field, options: parsedOptions || {} }
    })

    return { contentType: { ...contentType, fields: formattedFields } }
  } catch (error) {
    console.error("Error fetching content type:", error)
    return { error: "Internal server error" }
  }
}

export async function createContentTypeAction(tenantSlug: string, data: any) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return { error: "Unauthorized" }

    const access = await getTenantAccess(session, tenantSlug)
    if (!access) return { error: "Forbidden" }

    const rbac = await checkPermission(tenantSlug, PERMISSIONS.CONTENT_TYPE_CREATE)
    if (!rbac.allowed) return { error: "Forbidden" }

    const result = createContentTypeSchema.safeParse(data)
    if (!result.success) {
      console.error("Zod validation error in createContentTypeAction:", result.error)
      return { error: result.error.errors[0].message }
    }
    const { name, slug, description, docxTemplateUrl, fields } = result.data

    const { enforcePlanLimit } = await import("@/lib/plan-enforcement")
    const enforcement = await enforcePlanLimit(access.tenantId, "content_types")
    if (!enforcement.allowed) return { error: enforcement.message }

    const tenantDb = await getTenantDb(tenantSlug)

    const existingContentType = await tenantDb.contentType.findFirst({
      where: { 
        tenantId: access.tenantId,
        slug: slug
      },
    })

    if (existingContentType) return { error: "A content type with this slug already exists" }

    const contentType = await tenantDb.contentType.create({
      data: {
        tenantId: access.tenantId,
        name,
        slug,
        description,
        docxTemplateUrl,
        isPublished: true,
        fields: {
          create: fields
            ? fields.map((field: any, index: number) => ({
                name: field.name,
                slug: field.slug,
                type: field.type,
                required: field.required || false,
                unique: field.unique || false,
                options: field.options || {},
                jsonPath: field.jsonPath || null,
                relationSlug: field.relationSlug || null,
                order: index,
              }))
            : undefined,
        },
        tenants: {
          create: {
            tenantId: access.tenantId,
          },
        },
      },
      include: {
        fields: true,
      },
    })

    revalidatePath(`/dashboard/${tenantSlug}/content-types`)
    return { contentType }
  } catch (error) {
    console.error("Error creating content type:", error)
    return { error: "Internal server error" }
  }
}

export async function updateContentTypeAction(tenantSlug: string, id: string, data: any) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return { error: "Unauthorized" }

    const access = await getTenantAccess(session, tenantSlug)
    if (!access) return { error: "Forbidden" }

    const rbac = await checkPermission(tenantSlug, PERMISSIONS.CONTENT_TYPE_UPDATE)
    if (!rbac.allowed) return { error: "Forbidden" }

    const result = updateContentTypeSchema.safeParse(data)
    if (!result.success) return { error: result.error.errors[0].message }
    const { name, description, docxTemplateUrl, fields } = result.data

    const tenantDb = await getTenantDb(tenantSlug)

    const existingContentType = await tenantDb.contentType.findUnique({
      where: { id },
    })

    if (!existingContentType) return { error: "Content type not found" }

    const isGlobal = existingContentType.tenantId === null
    const isOwnedByOther = existingContentType.tenantId !== null && existingContentType.tenantId !== access.tenantId

    if (isGlobal || isOwnedByOther) {
      return { error: "Global or cross-tenant content types cannot be modified by tenant admins" }
    }

    const updatedContentType = await tenantDb.$transaction(async (tx) => {
      await tx.contentTypeField.deleteMany({
        where: { contentTypeId: id }
      })

      return await tx.contentType.update({
        where: { id },
        data: {
          name,
          description,
          docxTemplateUrl: docxTemplateUrl !== undefined ? docxTemplateUrl : existingContentType.docxTemplateUrl,
          fields: {
            create: fields?.map((field: any, index: number) => ({
              name: field.name,
              slug: field.slug,
              type: field.type,
              required: field.required || false,
              unique: field.unique || false,
              options: field.options || {},
              jsonPath: field.jsonPath || null,
              relationSlug: field.relationSlug || null,
              order: index,
            })) || [],
          },
        },
        include: {
          fields: { orderBy: { order: 'asc' } },
        },
      })
    })

    const formattedFields = updatedContentType.fields.map(field => {
      let parsedOptions = field.options
      if (typeof field.options === 'string') {
        try { parsedOptions = JSON.parse(field.options) } catch { parsedOptions = {} }
      }
      return { ...field, options: parsedOptions || {} }
    })

    revalidatePath(`/dashboard/${tenantSlug}/content-types`)
    revalidatePath(`/dashboard/${tenantSlug}/content-types/${updatedContentType.slug}`)
    
    return { contentType: { ...updatedContentType, fields: formattedFields } }
  } catch (error) {
    console.error("Error updating content type:", error)
    return { error: "Internal server error" }
  }
}

export async function deleteContentTypeAction(tenantSlug: string, id: string) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return { error: "Unauthorized" }

    const access = await getTenantAccess(session, tenantSlug)
    if (!access) return { error: "Forbidden" }

    const rbac = await checkPermission(tenantSlug, PERMISSIONS.CONTENT_TYPE_DELETE)
    if (!rbac.allowed) return { error: "Forbidden" }

    const tenantDb = await getTenantDb(tenantSlug)

    const existingContentType = await tenantDb.contentType.findUnique({
      where: { id },
      include: { tenants: true }
    })

    if (!existingContentType) return { error: "Content type not found" }

    const isGlobal = existingContentType.tenantId === null
    const isOwnedByOther = existingContentType.tenantId !== null && existingContentType.tenantId !== access.tenantId

    if (isGlobal || isOwnedByOther) {
      return { error: "Global content types cannot be deleted by tenant admins" }
    }

    await tenantDb.contentType.delete({ where: { id } })

    revalidatePath(`/dashboard/${tenantSlug}/content-types`)
    return { success: true }
  } catch (error) {
    console.error("Error deleting content type:", error)
    return { error: "Internal server error" }
  }
}
