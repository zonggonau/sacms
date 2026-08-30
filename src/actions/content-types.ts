"use server"
// Trigger Next.js rebuild for Prisma Client patch

import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { getTenantAccess } from "@/lib/tenant-access"
import { getTenantDb } from "@/lib/database"
import { checkPermission, PERMISSIONS } from "@/lib/rbac"
import { createContentTypeSchema, updateContentTypeSchema } from "@/lib/validations/admin"
import { revalidatePath } from "next/cache"
import { parseSchemaFieldOptions } from "./content-pipeline"

export async function getContentTypesAction(tenantSlug: string) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return { error: "Unauthorized" }

    const access = await getTenantAccess(session, tenantSlug)
    if (!access) return { error: "Forbidden" }

    const rbacContentType = await checkPermission(tenantSlug, PERMISSIONS.CONTENT_TYPE_READ)
    const rbacContent = await checkPermission(tenantSlug, PERMISSIONS.CONTENT_READ)
    if (!rbacContentType.allowed && !rbacContent.allowed) return { error: "Forbidden" }

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
          },
          ...(access.isGlobal ? [{ tenantId: null }] : [])
        ]
      },
      include: {
        schemaFields: {
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

        const formattedFields = parseSchemaFieldOptions(contentType.schemaFields)

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

    const rbacContentType = await checkPermission(tenantSlug, PERMISSIONS.CONTENT_TYPE_READ)
    const rbacContent = await checkPermission(tenantSlug, PERMISSIONS.CONTENT_READ)
    if (!rbacContentType.allowed && !rbacContent.allowed) return { error: "Forbidden" }

    const tenantDb = await getTenantDb(tenantSlug)

    const contentType = await tenantDb.contentType.findFirst({
      where: {
        id,
        OR: [
          { tenantId: access.tenantId },
          { tenants: { some: { tenantId: access.tenantId, enabled: true } } },
          ...(access.isGlobal ? [{ tenantId: null }] : [])
        ]
      },
      include: {
        schemaFields: {
          orderBy: { order: 'asc' },
        },
      },
    })

    if (!contentType) return { error: "Content type not found" }

    const formattedFields = parseSchemaFieldOptions(contentType.schemaFields)

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

    const rbacContentType = await checkPermission(tenantSlug, PERMISSIONS.CONTENT_TYPE_READ)
    const rbacContent = await checkPermission(tenantSlug, PERMISSIONS.CONTENT_READ)
    if (!rbacContentType.allowed && !rbacContent.allowed) return { error: "Forbidden" }

    const tenantDb = await getTenantDb(tenantSlug)

    const contentType = await tenantDb.contentType.findFirst({
      where: {
        slug,
        OR: [
          { tenantId: access.tenantId },
          { tenants: { some: { tenantId: access.tenantId, enabled: true } } },
          ...(access.isGlobal ? [{ tenantId: null }] : [])
        ]
      },
      include: {
        schemaFields: {
          orderBy: { order: 'asc' },
        },
      },
    })

    if (!contentType) return { error: "Content type not found" }

    const formattedFields = parseSchemaFieldOptions(contentType.schemaFields)

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
      return { error: result.error.issues[0]?.message ?? "Validation failed" }
    }
    const { name, slug, description, showInCms, docxTemplateUrl, fields } = result.data

    const { enforcePlanLimit } = await import("@/lib/plan-enforcement")
    const enforcement = await enforcePlanLimit(access.tenantId, "content_types", session.user.id)
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
        showInCms: showInCms ?? true,
        docxTemplateUrl,
        isPublished: true,
        schemaFields: {
          create: fields
            ? fields.map((field: any, index: number) => ({
                name: field.name,
                slug: field.slug,
                type: field.type,
                required: field.required || false,
                unique: field.unique || false,
                options: field.options || {},
                jsonPath: field.jsonPath || null,
                relationSlug: field.type === "relation" 
                  ? (field.relationSlug || field.targetSlug || (typeof field.options === 'object' ? field.options?.targetSlug : null) || null)
                  : null,
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
        schemaFields: true,
      },
    })

    revalidatePath(`/dashboard/${tenantSlug}/content-type-builder/content-types`)
    revalidatePath(`/dashboard/${tenantSlug}/cms`)
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
    if (!result.success) return { error: result.error.issues[0]?.message ?? "Validation failed" }
    const { name, description, showInCms, docxTemplateUrl, fields } = result.data

    const tenantDb = await getTenantDb(tenantSlug)

    const existingContentType = await tenantDb.contentType.findUnique({
      where: { id },
    })

    if (!existingContentType) return { error: "Content type not found" }

    const isGlobal = existingContentType.tenantId === null
    const isOwnedByOther = existingContentType.tenantId !== null && existingContentType.tenantId !== access.tenantId

    if (isGlobal && !access.isGlobal) {
      return { error: "Global content types cannot be modified by tenant admins" }
    }
    if (isOwnedByOther) {
      return { error: "Cross-tenant content types cannot be modified by tenant admins" }
    }

    const updatedContentType = await tenantDb.$transaction(async (tx) => {
      await tx.schemaField.deleteMany({
        where: { contentTypeId: id }
      })

      return await tx.contentType.update({
        where: { id },
        data: {
          name,
          description,
          showInCms: showInCms !== undefined ? showInCms : (existingContentType as any).showInCms ?? true,
          docxTemplateUrl: docxTemplateUrl !== undefined ? docxTemplateUrl : existingContentType.docxTemplateUrl,
          schemaFields: {
            create: fields?.map((field: any, index: number) => ({
              name: field.name,
              slug: field.slug,
              type: field.type,
              required: field.required || false,
              unique: field.unique || false,
              options: field.options || {},
              jsonPath: field.jsonPath || null,
              relationSlug: field.type === "relation" 
                ? (field.relationSlug || field.targetSlug || (typeof field.options === 'object' ? field.options?.targetSlug : null) || null)
                : null,
              order: index,
            })) || [],
          },
        },
        include: {
          schemaFields: { orderBy: { order: 'asc' } },
        },
      })
    })

    const formattedFields = parseSchemaFieldOptions(updatedContentType.schemaFields)

    revalidatePath(`/dashboard/${tenantSlug}/content-type-builder/content-types`)
    revalidatePath(`/dashboard/${tenantSlug}/content-type-builder/content-types/edit/${updatedContentType.slug}`)
    revalidatePath(`/dashboard/${tenantSlug}/cms/content/${updatedContentType.slug}`)
    revalidatePath(`/dashboard/${tenantSlug}/cms`)
    
    return { contentType: { ...updatedContentType, schemaFields: formattedFields } }
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

    if (isGlobal && !access.isGlobal) {
      return { error: "Global content types cannot be deleted by tenant admins" }
    }
    if (isOwnedByOther) {
      return { error: "Cross-tenant content types cannot be deleted by tenant admins" }
    }

    // Relational Dependency Guard: check if any schema field references this collection
    const referencingFields = await tenantDb.schemaField.findMany({
      where: {
        relationSlug: existingContentType.slug,
        NOT: { contentTypeId: id }
      },
      include: {
        contentType: true,
        singleType: true,
        component: true
      }
    })

    if (referencingFields.length > 0) {
      const parentName = referencingFields[0].contentType?.name || referencingFields[0].singleType?.name || referencingFields[0].component?.name || "skema lain"
      return { 
        error: `Tidak dapat menghapus koleksi "${existingContentType.name}" karena sedang direferensikan oleh field "${referencingFields[0].name}" pada ${parentName}. Hapus field relasi tersebut terlebih dahulu.` 
      }
    }

    await tenantDb.contentType.delete({ where: { id } })

    revalidatePath(`/dashboard/${tenantSlug}/content-type-builder/content-types`)
    revalidatePath(`/dashboard/${tenantSlug}/cms`)
    return { success: true }
  } catch (error) {
    console.error("Error deleting content type:", error)
    return { error: "Internal server error" }
  }
}
