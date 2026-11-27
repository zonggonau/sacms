"use server"
// Trigger Next.js rebuild for SingleType showInCms patch v4

import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { getTenantAccess } from "@/lib/tenant-access"
import { getTenantDb } from "@/lib/database"
import { checkPermission, PERMISSIONS } from "@/lib/rbac"
import { createSingleTypeSchema, updateSingleTypeSchema, saveSingleTypeDataSchema } from "@/lib/validations"
import { processAutoSlugs } from "@/lib/slug"
import { revalidatePath } from "next/cache"
import { parseSchemaFieldOptions } from "./content-pipeline"
import { validateContentEntry } from "@/lib/content-validations"
import { assertSchemaEditable } from "@/lib/schema-lock"
import {
  invalidateSingleTypePublication,
  readSingleTypeAssignment,
  singleTypeContentWrite,
} from "@/lib/single-type-publication"

// Halaman Statis (Single Types) content is meant to be entered by the
// workspace owner/admin, not regular members — unlike normal Content Types,
// there's no per-role RBAC permission for this, so it's gated directly on
// the tenant role.
function isStaticPageManager(role: string): boolean {
  return role === "owner" || role === "admin"
}

export async function getSingleTypesAction(tenantSlug: string, scope?: "studio") {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return { error: "Unauthorized" }

    const access = await getTenantAccess(session, tenantSlug)
    if (!access) return { error: "Forbidden" }
    if (!isStaticPageManager(access.role)) return { error: "Forbidden" }

    const rbacContentType = await checkPermission(tenantSlug, PERMISSIONS.CONTENT_TYPE_READ)
    const rbacContent = await checkPermission(tenantSlug, PERMISSIONS.CONTENT_READ)
    if (!rbacContentType.allowed && !rbacContent.allowed) return { error: "Forbidden" }

    const tenantId = access.tenantId
    const tenantDb = await getTenantDb(tenantSlug)

    const singleTypes = await tenantDb.singleType.findMany({
      where: {
        // See ContentType's getContentTypesAction — same draft-template
        // tagging convention, kept out of the normal list.
        draftTemplateId: null,
        ...(scope === "studio" ? { showInCms: true } : {}),
        OR: [
          { tenantId: tenantId },
          {
            tenantId: null,
            tenants: { some: { tenantId: tenantId, enabled: true } }
          },
        ]
      },
      include: {
        schemaFields: { orderBy: { order: 'asc' } }
      },
      orderBy: { name: 'asc' }
    })

    const assignments = await tenantDb.tenantSingleTypeAssignment.findMany({
      where: { tenantId }
    })
    const assignmentsByType = new Map(assignments.map((assignment) => [assignment.singleTypeId, assignment]))

    const singleTypesMap = new Map()

    for (const st of singleTypes) {
      const assignment = assignmentsByType.get(st.id)

      const formattedFields = parseSchemaFieldOptions(st.schemaFields)

      const mappedSt = {
        ...st,
        fields: formattedFields,
        data: assignment ? readSingleTypeAssignment(assignment, true).data : {},
        publishedAt: assignment?.publishedAt || null,
        hasPendingDraft: assignment?.draftData != null,
        ...(scope === "studio" ? { updatedAt: assignment?.updatedAt ?? null } : {}),
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

export async function getSingleTypeBySlugAction(tenantSlug: string, slug: string, scope?: "studio") {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return { error: "Unauthorized" }

    const access = await getTenantAccess(session, tenantSlug)
    if (!access) return { error: "Forbidden" }
    if (!isStaticPageManager(access.role)) return { error: "Forbidden" }

    const rbacContentType = await checkPermission(tenantSlug, PERMISSIONS.CONTENT_TYPE_READ)
    const rbacContent = await checkPermission(tenantSlug, PERMISSIONS.CONTENT_READ)
    if (!rbacContentType.allowed && !rbacContent.allowed) return { error: "Forbidden" }

    const tenantId = access.tenantId
    const tenantDb = await getTenantDb(tenantSlug)
    // No draftTemplateId:null filter — single-item lookup by slug is also
    // how the edit page reaches a template's materialized draft rows.
    const singleType = await tenantDb.singleType.findFirst({
      where: {
        slug,
        ...(scope === "studio" ? { draftTemplateId: null, showInCms: true } : {}),
        OR: [
          { tenantId: tenantId },
          {
            tenantId: null,
            tenants: { some: { tenantId: tenantId, enabled: true } }
          },
        ]
      },
      include: {
        schemaFields: { orderBy: { order: 'asc' } }
      },
      ...(scope === "studio" ? { orderBy: { tenantId: { sort: "desc", nulls: "last" } } } : {}),
    })

    if (!singleType) return { error: "Single type not found" }

    const assignment = await tenantDb.tenantSingleTypeAssignment.findFirst({
      where: { tenantId, singleTypeId: singleType.id }
    })

    const formattedFields = parseSchemaFieldOptions(singleType.schemaFields)

    return {
      singleType: {
        ...singleType,
        fields: formattedFields,
        data: assignment ? readSingleTypeAssignment(assignment, true).data : {},
        hasPendingDraft: assignment?.draftData != null,
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

    const lockError = await assertSchemaEditable(access.tenantId)
    if (lockError) return lockError

    const tenantId = access.tenantId
    const tenantDb = await getTenantDb(tenantSlug)

    const result = createSingleTypeSchema.safeParse(data)
    if (!result.success) return { error: result.error.issues[0]?.message ?? "Validation failed" }
    const { name, slug, description, showInCms, fields } = result.data

    const { enforcePlanLimit } = await import("@/lib/plan-enforcement")
    const enforcement = await enforcePlanLimit(tenantId, "content_types", session.user.id)
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
        showInCms: showInCms ?? true,
        isPublished: true,
        schemaFields: {
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
      include: { schemaFields: true }
    })

    revalidatePath(`/dashboard/${tenantSlug}/developer/single-types`)
    revalidatePath(`/dashboard/${tenantSlug}/cms`)
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

    const lockError = await assertSchemaEditable(access.tenantId)
    if (lockError) return lockError

    const tenantDb = await getTenantDb(tenantSlug)

    const result = updateSingleTypeSchema.safeParse(data)
    if (!result.success) return { error: result.error.issues[0]?.message ?? "Validation failed" }
    const { name, slug, description, showInCms, fields } = result.data

    // No draftTemplateId:null filter — this is how a template's materialized
    // draft rows get edited via the normal builder UI during authoring.
    const existingSingleType = await tenantDb.singleType.findFirst({
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
      await tx.schemaField.deleteMany({
        where: { singleTypeId: id },
      })

      return await tx.singleType.update({
        where: { id },
        data: {
          name,
          slug,
          description,
          showInCms: showInCms !== undefined ? showInCms : (existingSingleType as any).showInCms ?? true,
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

    const formattedFields = parseSchemaFieldOptions(updatedSingleType.schemaFields)

    revalidatePath(`/dashboard/${tenantSlug}/developer/single-types`)
    revalidatePath(`/dashboard/${tenantSlug}/developer/single-types/${updatedSingleType.slug}/edit`)
    revalidatePath(`/dashboard/${tenantSlug}/cms/single-types/${updatedSingleType.slug}`)
    revalidatePath(`/dashboard/${tenantSlug}/cms`)
    
    return { singleType: { ...updatedSingleType, schemaFields: formattedFields } }
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

    const lockError = await assertSchemaEditable(access.tenantId)
    if (lockError) return lockError

    const tenantDb = await getTenantDb(tenantSlug)

    const existingSingleType = await tenantDb.singleType.findFirst({
      where: { id },
      include: { tenants: true }
    })

    if (!existingSingleType) return { error: "Single type not found" }

    const isGlobal = existingSingleType.tenantId === null
    const isOwnedByOther = !isGlobal && existingSingleType.tenantId !== access.tenantId

    if (isGlobal || isOwnedByOther) {
      return { error: "Global single types cannot be deleted by tenant admins" }
    }

    // Relational Dependency Guard: check if any schema field references this single type
    const referencingFields = await tenantDb.schemaField.findMany({
      where: {
        relationSlug: existingSingleType.slug,
        NOT: { singleTypeId: id },
        OR: [
          { contentType: { tenantId: access.tenantId } },
          { singleType: { tenantId: access.tenantId } },
          { component: { tenantId: access.tenantId } },
          { contentType: { tenantId: null } },
          { singleType: { tenantId: null } },
          { component: { tenantId: null } },
        ],
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
        error: `Tidak dapat menghapus single type "${existingSingleType.name}" karena sedang direferensikan oleh field "${referencingFields[0].name}" pada ${parentName}. Hapus field relasi tersebut terlebih dahulu.` 
      }
    }

    await tenantDb.singleType.delete({ where: { id } })

    revalidatePath(`/dashboard/${tenantSlug}/developer/single-types`)
    revalidatePath(`/dashboard/${tenantSlug}/cms`)
    return { success: true }
  } catch (error) {
    console.error("Error deleting single type:", error)
    return { error: "Internal server error" }
  }
}

/**
 * Takes a Single Type offline: clears publishedAt so the
 * public API stops serving it. saveSingleTypeDataAction(..., publish:
 * false) can't do this — it only writes a draft and leaves the published
 * version live. The current published values move into the draft (unless
 * a newer draft already exists), so nothing is lost and republishing puts
 * the same content back.
 */
export async function unpublishSingleTypeAction(tenantSlug: string, singleTypeId: string) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return { error: "Unauthorized" }

    const access = await getTenantAccess(session, tenantSlug)
    if (!access) return { error: "Forbidden" }
    if (!isStaticPageManager(access.role)) return { error: "Forbidden" }

    const rbac = await checkPermission(tenantSlug, PERMISSIONS.CONTENT_PUBLISH)
    if (!rbac.allowed) return { error: "Forbidden" }

    const tenantId = access.tenantId
    const tenantDb = await getTenantDb(tenantSlug)
    const singleType = await tenantDb.singleType.findFirst({
      where: {
        id: singleTypeId,
        draftTemplateId: null,
        OR: [
          { tenantId },
          { tenantId: null, tenants: { some: { tenantId, enabled: true } } },
        ],
      },
      select: { id: true, slug: true },
    })
    if (!singleType) return { error: "Single type not found" }

    const assignment = await tenantDb.tenantSingleTypeAssignment.findUnique({
      where: { tenantId_singleTypeId: { tenantId, singleTypeId } },
    })
    if (!assignment?.publishedAt) return { error: "Single type ini belum terbit." }

    await tenantDb.tenantSingleTypeAssignment.update({
      where: { id: assignment.id },
      data: {
        publishedAt: null,
        ...(assignment.draftData == null ? { draftData: assignment.data ?? {} } : {}),
      },
    })
    await invalidateSingleTypePublication(tenantId, singleType.slug)

    revalidatePath(`/dashboard/${tenantSlug}/developer/single-types`)
    revalidatePath(`/dashboard/${tenantSlug}/cms/single-types/${singleType.slug}`)
    revalidatePath(`/dashboard/${tenantSlug}/cms/single-types`)
    revalidatePath(`/dashboard/${tenantSlug}/cms`)
    return { success: true }
  } catch (error) {
    console.error("Error unpublishing tenant single type:", error)
    return { error: "Internal server error" }
  }
}

export async function saveSingleTypeDataAction(
  tenantSlug: string,
  singleTypeId: string,
  data: unknown,
  publish?: boolean,
  scope?: "studio",
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return { error: "Unauthorized" }

    const access = await getTenantAccess(session, tenantSlug)
    if (!access) return { error: "Forbidden" }
    if (!isStaticPageManager(access.role)) return { error: "Forbidden" }

    const rbac = await checkPermission(tenantSlug, PERMISSIONS.CONTENT_UPDATE)
    if (!rbac.allowed) return { error: "Forbidden" }

    // saveSingleTypeDataSchema wraps {singleTypeId, data, publish}, but this
    // action receives the inner field-value record directly as `data` — so
    // we validate against its `data` sub-schema, not the whole object.
    const result = saveSingleTypeDataSchema.shape.data.safeParse(data)
    if (!result.success) return { error: result.error.issues[0]?.message ?? "Validation failed" }
    if (!result.data) return { error: "Data konten wajib diisi" }
    const shouldPublish = publish === true

    const tenantId = access.tenantId
    const tenantDb = await getTenantDb(tenantSlug)
    const singleType = await tenantDb.singleType.findFirst({
      where: {
        id: singleTypeId,
        draftTemplateId: null,
        ...(scope === "studio" ? { showInCms: true } : {}),
        OR: [
          { tenantId: tenantId },
          { tenantId: null, tenants: { some: { tenantId: tenantId, enabled: true } } }
        ]
      },
      include: { schemaFields: true }
    })

    if (!singleType) return { error: "Single type not found" }

    const schemaFields = parseSchemaFieldOptions(singleType.schemaFields)
    const fieldsForValidation = scope === "studio"
      ? schemaFields.map((field) => field.showInCms ? field : { ...field, required: false })
      : schemaFields
    const schemaValidation = await validateContentEntry(fieldsForValidation, result.data, {
      enforceRequired: shouldPublish,
    })
    if (!schemaValidation.success) {
      return { error: "Validasi gagal", details: schemaValidation.errors }
    }

    const processedData = await processAutoSlugs(
      tenantId,
      singleTypeId,
      schemaFields,
      result.data,
      undefined,
      "single",
      tenantDb,
    )
    const content = singleTypeContentWrite(processedData, shouldPublish)
    const assignment = await tenantDb.tenantSingleTypeAssignment.upsert({
      where: { tenantId_singleTypeId: { tenantId, singleTypeId } },
      create: { tenantId, singleTypeId, ...content },
      update: content,
    })

    if (shouldPublish) await invalidateSingleTypePublication(tenantId, singleType.slug)

    revalidatePath(`/dashboard/${tenantSlug}/developer/single-types`)
    revalidatePath(`/dashboard/${tenantSlug}/cms/single-types/${singleType.slug}`)
    revalidatePath(`/dashboard/${tenantSlug}/cms/single-types`)
    revalidatePath(`/dashboard/${tenantSlug}/cms`)
    
    return {
      singleType: {
        ...singleType,
        data: readSingleTypeAssignment(assignment, true).data,
        publishedAt: assignment.publishedAt,
        hasPendingDraft: assignment.draftData != null,
      }
    }
  } catch (error) {
    console.error("Error updating tenant single type data:", error)
    return { error: "Internal server error" }
  }
}
