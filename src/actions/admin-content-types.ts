"use server"

import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/database"
import { createContentTypeSchema, updateContentTypeSchema } from "@/lib/validations/admin"
import { revalidatePath } from "next/cache"
import { Prisma } from "@prisma/client"

export async function getAdminContentTypesAction() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || session.user.role !== "super_admin") return { error: "Unauthorized" }

    const contentTypes = await db.contentType.findMany({
      where: { tenantId: null },
      include: {
        schemaFields: { orderBy: { order: "asc" } },
        _count: { select: { entries: true } }
      },
      orderBy: { updatedAt: "desc" },
    })

    const formatted = contentTypes.map((ct) => ({
      ...ct,
      entryCount: ct._count.entries,
      fields: ct.schemaFields.map(f => {
        let parsedOptions = f.options
        if (typeof f.options === 'string') {
          try { parsedOptions = JSON.parse(f.options) } catch { parsedOptions = {} }
        }
        return { ...f, options: parsedOptions || {} }
      }),
      isGlobal: true,
    }))

    return { contentTypes: formatted }
  } catch (error) {
    console.error("Error fetching admin content types:", error)
    return { error: "Internal server error" }
  }
}

export async function getAdminContentTypeBySlugAction(slug: string) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || session.user.role !== "super_admin") return { error: "Unauthorized" }

    const contentType = await db.contentType.findFirst({
      where: { slug, tenantId: null },
      include: { schemaFields: { orderBy: { order: 'asc' } } },
    })

    if (!contentType) return { error: "Content type not found" }

    const formattedFields = contentType.schemaFields.map(field => {
      let parsedOptions = field.options
      if (typeof field.options === 'string') {
        try { parsedOptions = JSON.parse(field.options) } catch { parsedOptions = {} }
      }
      return { ...field, options: parsedOptions || {} }
    })

    return { contentType: { ...contentType, fields: formattedFields, isGlobal: true } }
  } catch (error) {
    console.error("Error fetching admin content type:", error)
    return { error: "Internal server error" }
  }
}

export async function createAdminContentTypeAction(data: any) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || session.user.role !== "super_admin") return { error: "Unauthorized" }

    const result = createContentTypeSchema.safeParse(data)
    if (!result.success) return { error: result.error.issues[0]?.message ?? "Validation failed" }
    const { name, slug, description, docxTemplateUrl, fields } = result.data

    const existing = await db.contentType.findFirst({ where: { slug, tenantId: null } })
    if (existing) return { error: "A content type with this slug already exists" }

    const contentType = await db.contentType.create({
      data: {
        tenantId: null,
        name,
        slug,
        description,
        docxTemplateUrl,
        isPublished: true,
        schemaFields: {
          create: fields?.map((field: any, index: number) => ({
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
        },
      },
    })

    revalidatePath(`/admin/cms/content-types`)
    return { contentType }
  } catch (error) {
    console.error("Error creating admin content type:", error)
    return { error: "Internal server error" }
  }
}

export async function updateAdminContentTypeAction(id: string, data: any) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || session.user.role !== "super_admin") return { error: "Unauthorized" }

    const result = updateContentTypeSchema.safeParse(data)
    if (!result.success) return { error: result.error.issues[0]?.message ?? "Validation failed" }
    const { name, description, docxTemplateUrl, fields } = result.data

    const existing = await db.contentType.findUnique({ where: { id } })
    if (!existing || existing.tenantId !== null) return { error: "Content type not found or not global" }

    const updatedContentType = await db.$transaction(async (tx) => {
      await tx.schemaField.deleteMany({ where: { contentTypeId: id } })
      return await tx.contentType.update({
        where: { id },
        data: {
          name,
          description,
          docxTemplateUrl: docxTemplateUrl !== undefined ? docxTemplateUrl : existing.docxTemplateUrl,
          schemaFields: {
            create: fields?.map((field: any, index: number) => ({
              name: field.name,
              slug: field.slug,
              type: field.type,
              required: field.required || false,
              unique: field.unique || false,
              options: field.options || Prisma.JsonNull,
              jsonPath: field.jsonPath || null,
              relationSlug: field.relationSlug || null,
              order: index,
            })) || [],
          },
        },
      })
    })

    revalidatePath(`/admin/cms/content-types`)
    revalidatePath(`/admin/cms/content-types/${updatedContentType.slug}`)
    
    return { contentType: updatedContentType }
  } catch (error) {
    console.error("Error updating admin content type:", error)
    return { error: "Internal server error" }
  }
}

export async function deleteAdminContentTypeAction(id: string) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || session.user.role !== "super_admin") return { error: "Unauthorized" }

    const existing = await db.contentType.findUnique({ where: { id } })
    if (!existing || existing.tenantId !== null) return { error: "Content type not found or not global" }

    await db.contentType.delete({ where: { id } })
    revalidatePath(`/admin/cms/content-types`)
    
    return { success: true }
  } catch (error) {
    console.error("Error deleting admin content type:", error)
    return { error: "Internal server error" }
  }
}
