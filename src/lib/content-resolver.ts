import type { Prisma, PrismaClient } from "@/lib/database"
import { db } from "@/lib/database"
import { parseSingleTypeData, readSingleTypeAssignment } from "@/lib/single-type-publication"

interface ContentResolutionOptions {
  client?: PrismaClient
  includeUnpublished?: boolean
  includeSingleTypeDraft?: boolean
  locale?: string
}

/**
 * Resolves a content entry or single type data by resolving its relations and components.
 * This ensures that the dynamic content (like Hero Sections or Related News) is fully
 * populated in the API response.
 */
export async function resolveContentData(
  tenantId: string,
  data: any,
  schemaFields: any[],
  options: ContentResolutionOptions = {},
): Promise<any> {
  return resolveFields(tenantId, data, schemaFields, options, new Set())
}

async function resolveFields(
  tenantId: string,
  data: any,
  schemaFields: any[],
  settings: ContentResolutionOptions,
  ancestors: ReadonlySet<string>,
): Promise<any> {
  if (!data || !schemaFields || schemaFields.length === 0) return data

  const client = settings.client ?? db
  const resolvedData = { ...data }

  for (const field of schemaFields) {
    const value = resolvedData[field.slug]
    if (value === undefined || value === null) continue

    let options = field.options
    if (typeof field.options === "string") {
      try { options = JSON.parse(field.options) } catch { options = {} }
    }

    if (field.type === "relation") {
      const targetModel = options?.targetModel || 'content-type'

      // Resolve relation (single or multiple)
      if (Array.isArray(value)) {
        resolvedData[field.slug] = await Promise.all(
          value.map((id) => resolveRelation(tenantId, id, targetModel, settings, ancestors))
        )
      } else if (typeof value === 'string' && value.length > 0) {
        resolvedData[field.slug] = await resolveRelation(tenantId, value, targetModel, settings, ancestors)
      }
    } else if (field.type === "component") {
      // Resolve component fields
      const componentSlug = options?.componentSlug
      const repeatable = options?.repeatable || false

      if (componentSlug) {
        const component = await client.component.findFirst({
          where: { 
            slug: componentSlug,
            draftTemplateId: null,
            OR: [
              { tenantId: tenantId },
              { tenantId: null }
            ]
          },
          orderBy: {
            tenantId: { sort: 'desc', nulls: 'last' }
          },
          include: { schemaFields: true },
        })

        if (component) {
          if (repeatable && Array.isArray(value)) {
            resolvedData[field.slug] = await Promise.all(
              value.map((item) => resolveFields(tenantId, item, component.schemaFields, settings, ancestors))
            )
          } else if (!repeatable && value && typeof value === 'object') {
            resolvedData[field.slug] = await resolveFields(tenantId, value, component.schemaFields, settings, ancestors)
          }
        }
      }
    }
  }

  return resolvedData
}

/**
 * Resolves a single relation by ID or Slug. 
 * Supports both ContentEntry and SingleType data.
 */
async function resolveRelation(
  tenantId: string,
  idOrSlug: string,
  targetModel: string,
  options: ContentResolutionOptions,
  ancestors: ReadonlySet<string>,
): Promise<any> {
  if (typeof idOrSlug !== "string") return idOrSlug

  const relationKey = `${targetModel}:${idOrSlug}`
  if (ancestors.has(relationKey)) return idOrSlug
  const nextAncestors = new Set(ancestors).add(relationKey)
  const client = options.client ?? db

  // If we specifically know it's a single-type (from field config options.targetModel)
  if (targetModel === 'single-type') {
    const includeDraft = options.includeSingleTypeDraft === true
    const singleType = await client.singleType.findFirst({
      where: { slug: idOrSlug, draftTemplateId: null, OR: [{ tenantId }, { tenantId: null }] },
      include: { schemaFields: true },
      orderBy: { tenantId: { sort: "desc", nulls: "last" } },
    })
    
    if (singleType) {
      const where: Prisma.TenantSingleTypeAssignmentWhereInput = {
        tenantId, singleTypeId: singleType.id, enabled: true,
        ...(!includeDraft && { publishedAt: { not: null } }),
      }
      const assignment = (options.locale && await client.tenantSingleTypeAssignment.findFirst({
        where: { ...where, locale: options.locale },
      })) || await client.tenantSingleTypeAssignment.findFirst({ where, orderBy: { locale: "asc" } })

      if (assignment) {
        const { data } = readSingleTypeAssignment(assignment, includeDraft)
        const resolvedData = await resolveFields(tenantId, data, singleType.schemaFields, options, nextAncestors)
        return {
          id: idOrSlug, // using slug as ID for single type references
          ...resolvedData,
          _meta: {
            singleType: singleType.slug,
            publishedAt: assignment.publishedAt,
            locale: assignment.locale
          }
        }
      }
    }
    return null
  }

  if (targetModel === 'member') {
    const member = await client.member.findFirst({
      where: { id: idOrSlug, tenantId },
      select: { id: true, name: true, email: true, avatar: true, role: true, status: true, createdAt: true },
    })
    // Deliberately excludes passwordHash and any other member-auth internals
    // — this is the public-facing content API, and a populated relation
    // must never leak credential material.
    return member || null
  }

  // Try to find as content entry (default)
  const entry = await client.contentEntry.findFirst({
    where: {
      id: idOrSlug, tenantId, deletedAt: null,
      contentType: { draftTemplateId: null },
      ...(options.includeUnpublished === false && { status: "PUBLISHED" as const }),
    },
    include: { contentType: { include: { schemaFields: true } } },
  })

  if (entry) {
    // Recursively resolve the entry's data
    const resolvedEntryData = await resolveFields(
      tenantId,
      parseSingleTypeData(entry.data),
      entry.contentType.schemaFields,
      options,
      nextAncestors,
    )

    return {
      id: entry.id,
      ...resolvedEntryData,
      _meta: {
        contentType: entry.contentType.slug,
        status: entry.status,
        publishedAt: entry.publishedAt,
        locale: entry.locale,
      }
    }
  }

  // Fallback if not found or not an ID
  return idOrSlug
}
