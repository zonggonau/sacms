"use server"

import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/database"
import { createSingleTypeSchema, updateSingleTypeSchema, saveSingleTypeDataSchema } from "@/lib/validations/admin"
import { processAutoSlugs } from "@/lib/slug"
import { revalidatePath } from "next/cache"
import { Prisma } from "@prisma/client"

export async function getAdminSingleTypesAction() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || session.user.role !== "super_admin") return { error: "Unauthorized" }

    const singleTypes = await db.singleType.findMany({
      where: { tenantId: null },
      include: {
        schemaFields: { orderBy: { order: 'asc' } }
      },
      orderBy: { name: 'asc' }
    })

    const assignments = await db.tenantSingleTypeAssignment.findMany({
      where: { tenantId: null }
    })

    const singleTypesMap = new Map()

    for (const st of singleTypes) {
      const assignment = assignments.find(a => a.singleTypeId === st.id)

      let parsedData = {}
      if (assignment?.data) {
        try {
          parsedData = typeof assignment.data === 'string' ? JSON.parse(assignment.data) : assignment.data
        } catch { parsedData = {} }
      }

      const formattedFields = st.schemaFields.map(field => {
        let parsedOptions = field.options
        if (typeof field.options === 'string') {
          try { parsedOptions = JSON.parse(field.options) } catch { parsedOptions = {} }
        }
        return { ...field, options: parsedOptions || {} }
      })

      const mappedSt = {
        ...st,
        fields: formattedFields,
        data: parsedData,
        publishedAt: assignment?.publishedAt || null,
        isGlobal: true,
      }

      singleTypesMap.set(st.slug, mappedSt)
    }

    return { singleTypes: Array.from(singleTypesMap.values()) }
  } catch (error) {
    console.error("Error fetching admin single types:", error)
    return { error: "Internal server error" }
  }
}

export async function getAdminSingleTypeBySlugAction(slug: string) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || session.user.role !== "super_admin") return { error: "Unauthorized" }

    const singleType = await db.singleType.findFirst({
      where: { slug, tenantId: null },
      include: {
        schemaFields: { orderBy: { order: 'asc' } }
      }
    })

    if (!singleType) return { error: "Single type not found" }

    const assignment = await db.tenantSingleTypeAssignment.findFirst({
      where: { tenantId: null, singleTypeId: singleType.id }
    })

    let parsedData = {}
    if (assignment?.data) {
      try {
        parsedData = typeof assignment.data === 'string' ? JSON.parse(assignment.data) : assignment.data
      } catch { parsedData = {} }
    }

    const formattedFields = singleType.schemaFields.map(field => {
      let parsedOptions = field.options
      if (typeof field.options === 'string') {
        try { parsedOptions = JSON.parse(field.options) } catch { parsedOptions = {} }
      }
      return { ...field, options: parsedOptions || {} }
    })

    return { 
      singleType: {
        ...singleType,
        fields: formattedFields,
        data: parsedData,
        publishedAt: assignment?.publishedAt || null,
        isGlobal: true,
      } 
    }
  } catch (error) {
    console.error("Error fetching admin single type:", error)
    return { error: "Internal server error" }
  }
}

export async function createAdminSingleTypeAction(data: any) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || session.user.role !== "super_admin") return { error: "Unauthorized" }

    const result = createSingleTypeSchema.safeParse(data)
    if (!result.success) return { error: result.error.issues[0]?.message ?? "Validation failed" }
    const { name, slug, description, fields } = result.data

    const existing = await db.singleType.findFirst({
      where: { tenantId: null, slug }
    })

    if (existing) return { error: "Slug already exists in global space" }

    const singleType = await db.singleType.create({
      data: {
        tenantId: null,
        name,
        slug,
        description,
        isPublished: true,
        schemaFields: {
          create: fields?.map((field: any, index: number) => ({
            name: field.name,
            slug: field.slug,
            type: field.type,
            required: !!field.required,
            unique: !!field.unique,
            options: field.options || Prisma.JsonNull,
            jsonPath: field.jsonPath || null,
            relationSlug: field.relationSlug || null,
            order: index,
          })) || [],
        },
      },
      include: { schemaFields: true }
    })

    revalidatePath(`/admin/cms/single-types`)
    return { singleType }
  } catch (error) {
    console.error("Error creating admin single type:", error)
    return { error: "Internal server error" }
  }
}

export async function updateAdminSingleTypeAction(id: string, data: any) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || session.user.role !== "super_admin") return { error: "Unauthorized" }

    const result = updateSingleTypeSchema.safeParse(data)
    if (!result.success) return { error: result.error.issues[0]?.message ?? "Validation failed" }
    const { name, slug, description, fields } = result.data

    const existingSingleType = await db.singleType.findUnique({
      where: { id },
    })

    if (!existingSingleType || existingSingleType.tenantId !== null) return { error: "Global single type not found" }

    if (slug && slug !== existingSingleType.slug) {
      const slugConflict = await db.singleType.findFirst({
        where: { slug, tenantId: null },
      })
      if (slugConflict) return { error: "A single type with this slug already exists" }
    }

    const updatedSingleType = await db.$transaction(async (tx) => {
      await tx.schemaField.deleteMany({
        where: { singleTypeId: id },
      })

      return await tx.singleType.update({
        where: { id },
        data: {
          name,
          slug,
          description,
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

    const formattedFields = updatedSingleType.schemaFields.map(field => {
      let parsedOptions = field.options
      if (typeof field.options === 'string') {
        try { parsedOptions = JSON.parse(field.options) } catch { parsedOptions = {} }
      }
      return { ...field, options: parsedOptions || {} }
    })

    revalidatePath(`/admin/cms/single-types`)
    revalidatePath(`/admin/cms/single-types/${updatedSingleType.slug}`)
    
    return { singleType: { ...updatedSingleType, schemaFields: formattedFields } }
  } catch (error) {
    console.error("Error updating admin single type:", error)
    return { error: "Internal server error" }
  }
}

export async function deleteAdminSingleTypeAction(id: string) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || session.user.role !== "super_admin") return { error: "Unauthorized" }

    const existingSingleType = await db.singleType.findUnique({
      where: { id },
    })

    if (!existingSingleType || existingSingleType.tenantId !== null) return { error: "Global single type not found" }

    await db.singleType.delete({ where: { id } })

    revalidatePath(`/admin/cms/single-types`)
    return { success: true }
  } catch (error) {
    console.error("Error deleting admin single type:", error)
    return { error: "Internal server error" }
  }
}

export async function saveAdminSingleTypeDataAction(singleTypeId: string, data: any, publish?: boolean) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || session.user.role !== "super_admin") return { error: "Unauthorized" }

    const singleType = await db.singleType.findFirst({
      where: {
        id: singleTypeId,
        tenantId: null
      },
      include: { schemaFields: true }
    })

    if (!singleType) return { error: "Single type not found" }

    let processedData = data
    if (data) {
      processedData = await processAutoSlugs(
        null as any,
        singleTypeId,
        singleType.schemaFields,
        data,
        undefined,
        'single',
        db
      )
    }

    const existingAssignment = await db.tenantSingleTypeAssignment.findFirst({
      where: { tenantId: null, singleTypeId },
    })

    let assignment
    if (!existingAssignment) {
      assignment = await db.tenantSingleTypeAssignment.create({
        data: {
          tenantId: null,
          singleTypeId,
          enabled: true,
          data: processedData ? JSON.stringify(processedData) : Prisma.JsonNull,
          publishedAt: publish ? new Date() : null,
        },
        include: { singleType: true },
      })
    } else {
      assignment = await db.tenantSingleTypeAssignment.update({
        where: { id: existingAssignment.id },
        data: {
          data: processedData ? JSON.stringify(processedData) : undefined,
          publishedAt: publish ? new Date() : undefined,
        },
        include: { singleType: true },
      })
    }

    revalidatePath(`/admin/cms/single-types`)
    revalidatePath(`/admin/cms/single-types/${singleType.slug}`)
    
    return {
      singleType: {
        ...assignment.singleType,
        data: assignment.data ? (typeof assignment.data === 'string' ? JSON.parse(assignment.data) : assignment.data) : null,
        publishedAt: assignment.publishedAt,
      }
    }
  } catch (error) {
    console.error("Error updating admin single type data:", error)
    return { error: "Internal server error" }
  }
}
