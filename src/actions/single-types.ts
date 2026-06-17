"use server"

import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { getTenantAccess } from "@/lib/tenant-access"
import { getTenantDb } from "@/lib/database"
import { checkPermission, PERMISSIONS } from "@/lib/rbac"
import { createSingleTypeSchema, updateSingleTypeSchema, saveSingleTypeDataSchema } from "@/lib/validations"
import { processAutoSlugs } from "@/lib/slug"
import { revalidatePath } from "next/cache"

export async function getSingleTypesAction(tenantSlug: string) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return { error: "Unauthorized" }

    const access = await getTenantAccess(session, tenantSlug)
    if (!access) return { error: "Forbidden" }

    const rbac = await checkPermission(tenantSlug, PERMISSIONS.CONTENT_TYPE_READ)
    if (!rbac.allowed) return { error: "Forbidden" }

    const tenantId = access.tenantId
    const tenantDb = await getTenantDb(tenantSlug)

    const singleTypes = await tenantDb.singleType.findMany({
      where: {
        OR: [
          { tenantId: tenantId },
          { 
            tenantId: null,
            tenants: { some: { tenantId: tenantId, enabled: true } }
          }
        ]
      },
      include: {
        fields: { orderBy: { order: 'asc' } }
      },
      orderBy: { name: 'asc' }
    })

    const assignments = await tenantDb.tenantSingleTypeAssignment.findMany({
      where: { tenantId: tenantId }
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

      const formattedFields = st.fields.map(field => {
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
        isGlobal: st.tenantId === null,
      }

      if (!singleTypesMap.has(st.slug) || st.tenantId !== null) {
        singleTypesMap.set(st.slug, mappedSt)
      }
    }

    return { singleTypes: Array.from(singleTypesMap.values()) }
  } catch (error) {
    console.error("Error fetching single types:", error)
    return { error: "Internal server error" }
  }
}

export async function getSingleTypeBySlugAction(tenantSlug: string, slug: string) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return { error: "Unauthorized" }

    const access = await getTenantAccess(session, tenantSlug)
    if (!access) return { error: "Forbidden" }

    const rbac = await checkPermission(tenantSlug, PERMISSIONS.CONTENT_TYPE_READ)
    if (!rbac.allowed) return { error: "Forbidden" }

    const tenantId = access.tenantId
    const tenantDb = await getTenantDb(tenantSlug)

    const singleType = await tenantDb.singleType.findFirst({
      where: {
        slug,
        OR: [
          { tenantId: tenantId },
          { 
            tenantId: null,
            tenants: { some: { tenantId: tenantId, enabled: true } }
          }
        ]
      },
      include: {
        fields: { orderBy: { order: 'asc' } }
      }
    })

    if (!singleType) return { error: "Single type not found" }

    const assignment = await tenantDb.tenantSingleTypeAssignment.findFirst({
      where: { tenantId: tenantId, singleTypeId: singleType.id }
    })

    let parsedData = {}
    if (assignment?.data) {
      try {
        parsedData = typeof assignment.data === 'string' ? JSON.parse(assignment.data) : assignment.data
      } catch { parsedData = {} }
    }

    const formattedFields = singleType.fields.map(field => {
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
        isGlobal: singleType.tenantId === null,
      } 
    }
  } catch (error) {
    console.error("Error fetching single type:", error)
    return { error: "Internal server error" }
  }
}

export async function createSingleTypeAction(tenantSlug: string, data: any) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return { error: "Unauthorized" }

    const access = await getTenantAccess(session, tenantSlug)
    if (!access) return { error: "Forbidden" }

    const rbac = await checkPermission(tenantSlug, PERMISSIONS.CONTENT_TYPE_CREATE)
    if (!rbac.allowed) return { error: "Forbidden" }

    const tenantId = access.tenantId
    const tenantDb = await getTenantDb(tenantSlug)

    const result = createSingleTypeSchema.safeParse(data)
    if (!result.success) return { error: result.error.errors[0].message }
    const { name, slug, description, fields } = result.data

    const { enforcePlanLimit } = await import("@/lib/plan-enforcement")
    const enforcement = await enforcePlanLimit(tenantId, "content_types")
    if (!enforcement.allowed) return { error: enforcement.message }

    const existing = await tenantDb.singleType.findFirst({
      where: { tenantId: tenantId, slug }
    })

    if (existing) return { error: "Slug already exists in this workspace" }

    const singleType = await tenantDb.singleType.create({
      data: {
        tenantId: tenantId,
        name,
        slug,
        description,
        isPublished: true,
        fields: {
          create: fields?.map((field: any, index: number) => ({
            name: field.name,
            slug: field.slug,
            type: field.type,
            required: !!field.required,
            unique: !!field.unique,
            options: field.options || {},
            jsonPath: field.jsonPath || null,
            relationSlug: field.relationSlug || null,
            order: index,
          })) || [],
        },
        tenants: {
          create: {
            tenantId: tenantId,
            enabled: true,
          }
        }
      },
      include: { fields: true }
    })

    revalidatePath(`/dashboard/${tenantSlug}/single-types`)
    return { singleType }
  } catch (error) {
    console.error("Error creating single type:", error)
    return { error: "Internal server error" }
  }
}

export async function updateSingleTypeAction(tenantSlug: string, id: string, data: any) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return { error: "Unauthorized" }

    const access = await getTenantAccess(session, tenantSlug)
    if (!access) return { error: "Forbidden" }

    const rbac = await checkPermission(tenantSlug, PERMISSIONS.CONTENT_TYPE_UPDATE)
    if (!rbac.allowed) return { error: "Forbidden" }

    const tenantDb = await getTenantDb(tenantSlug)

    const result = updateSingleTypeSchema.safeParse(data)
    if (!result.success) return { error: result.error.errors[0].message }
    const { name, slug, description, fields } = result.data

    const existingSingleType = await tenantDb.singleType.findUnique({
      where: { id },
    })

    if (!existingSingleType) return { error: "Single type not found" }

    const isGlobal = existingSingleType.tenantId === null
    const isOwnedByOther = existingSingleType.tenantId !== null && existingSingleType.tenantId !== access.tenantId

    if (isGlobal || isOwnedByOther) {
      return { error: "Global or cross-tenant single types cannot be modified by tenant admins" }
    }

    if (slug && slug !== existingSingleType.slug) {
      const slugConflict = await tenantDb.singleType.findFirst({
        where: { slug, tenantId: access.tenantId },
      })
      if (slugConflict) return { error: "A single type with this slug already exists" }
    }

    const updatedSingleType = await tenantDb.$transaction(async (tx) => {
      await tx.singleTypeField.deleteMany({
        where: { singleTypeId: id },
      })

      return await tx.singleType.update({
        where: { id },
        data: {
          name,
          slug,
          description,
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

    const formattedFields = updatedSingleType.fields.map(field => {
      let parsedOptions = field.options
      if (typeof field.options === 'string') {
        try { parsedOptions = JSON.parse(field.options) } catch { parsedOptions = {} }
      }
      return { ...field, options: parsedOptions || {} }
    })

    revalidatePath(`/dashboard/${tenantSlug}/single-types`)
    revalidatePath(`/dashboard/${tenantSlug}/single-types/${updatedSingleType.slug}`)
    
    return { singleType: { ...updatedSingleType, fields: formattedFields } }
  } catch (error) {
    console.error("Error updating single type:", error)
    return { error: "Internal server error" }
  }
}

export async function deleteSingleTypeAction(tenantSlug: string, id: string) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return { error: "Unauthorized" }

    const access = await getTenantAccess(session, tenantSlug)
    if (!access) return { error: "Forbidden" }

    const rbac = await checkPermission(tenantSlug, PERMISSIONS.CONTENT_TYPE_DELETE)
    if (!rbac.allowed) return { error: "Forbidden" }

    const tenantDb = await getTenantDb(tenantSlug)

    const existingSingleType = await tenantDb.singleType.findUnique({
      where: { id },
      include: { tenants: true }
    })

    if (!existingSingleType) return { error: "Single type not found" }

    const isGlobal = existingSingleType.tenantId === null
    const isOwnedByOther = !isGlobal && existingSingleType.tenantId !== access.tenantId

    if (isGlobal || isOwnedByOther) {
      return { error: "Global single types cannot be deleted by tenant admins" }
    }

    await tenantDb.singleType.delete({ where: { id } })

    revalidatePath(`/dashboard/${tenantSlug}/single-types`)
    return { success: true }
  } catch (error) {
    console.error("Error deleting single type:", error)
    return { error: "Internal server error" }
  }
}

export async function saveSingleTypeDataAction(tenantSlug: string, singleTypeId: string, data: any, publish?: boolean) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return { error: "Unauthorized" }

    const access = await getTenantAccess(session, tenantSlug)
    if (!access) return { error: "Forbidden" }

    const tenantId = access.tenantId
    const tenantDb = await getTenantDb(tenantSlug)

    const singleType = await tenantDb.singleType.findFirst({
      where: {
        id: singleTypeId,
        OR: [
          { tenantId: tenantId },
          { tenantId: null, tenants: { some: { tenantId: tenantId, enabled: true } } }
        ]
      },
      include: { fields: true }
    })

    if (!singleType) return { error: "Single type not found" }

    let processedData = data
    if (data) {
      processedData = await processAutoSlugs(
        tenantId,
        singleTypeId,
        singleType.fields,
        data,
        undefined,
        'single',
        tenantDb
      )
    }

    const existingAssignment = await tenantDb.tenantSingleTypeAssignment.findFirst({
      where: { tenantId: tenantId, singleTypeId },
    })

    let assignment
    if (!existingAssignment) {
      assignment = await tenantDb.tenantSingleTypeAssignment.create({
        data: {
          tenantId: tenantId,
          singleTypeId,
          enabled: true,
          data: processedData ? JSON.stringify(processedData) : null,
          publishedAt: publish ? new Date() : null,
        },
        include: { singleType: true },
      })
    } else {
      assignment = await tenantDb.tenantSingleTypeAssignment.update({
        where: { id: existingAssignment.id },
        data: {
          data: processedData ? JSON.stringify(processedData) : undefined,
          publishedAt: publish ? new Date() : undefined,
        },
        include: { singleType: true },
      })
    }

    revalidatePath(`/dashboard/${tenantSlug}/single-types`)
    revalidatePath(`/dashboard/${tenantSlug}/single-types/${singleType.slug}`)
    
    return {
      singleType: {
        ...assignment.singleType,
        data: assignment.data ? JSON.parse(assignment.data as string) : null,
        publishedAt: assignment.publishedAt,
      }
    }
  } catch (error) {
    console.error("Error updating tenant single type data:", error)
    return { error: "Internal server error" }
  }
}
