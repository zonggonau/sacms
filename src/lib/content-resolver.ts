import { db } from "@/lib/database"

/**
 * Resolves a content entry or single type data by resolving its relations and components.
 * This ensures that the dynamic content (like Hero Sections or Related News) is fully
 * populated in the API response.
 */
export async function resolveContentData(
  tenantId: string,
  data: any,
  schemaFields: any[]
): Promise<any> {
  if (!data || !schemaFields || schemaFields.length === 0) return data

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
          value.map((id) => resolveRelation(tenantId, id, targetModel))
        )
      } else if (typeof value === 'string' && value.length > 0) {
        resolvedData[field.slug] = await resolveRelation(tenantId, value, targetModel)
      }
    } else if (field.type === "component") {
      // Resolve component fields
      const componentSlug = options?.componentSlug
      const repeatable = options?.repeatable || false

      if (componentSlug) {
        const component = await db.component.findFirst({
          where: { 
            slug: componentSlug,
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
              value.map((item) => resolveContentData(tenantId, item, component.schemaFields))
            )
          } else if (!repeatable && value && typeof value === 'object') {
            resolvedData[field.slug] = await resolveContentData(tenantId, value, component.schemaFields)
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
async function resolveRelation(tenantId: string, idOrSlug: string, targetModel: string): Promise<any> {
  if (typeof idOrSlug !== "string") return idOrSlug

  // If we specifically know it's a single-type (from field config options.targetModel)
  if (targetModel === 'single-type') {
    const singleType = await db.singleType.findFirst({
      where: { slug: idOrSlug, OR: [{ tenantId }, { tenantId: null }] },
      include: { schemaFields: true }
    })
    
    if (singleType) {
      const assignment = await db.tenantSingleTypeAssignment.findFirst({
        where: { tenantId, singleTypeId: singleType.id }
      })
      
      if (assignment?.data) {
        let parsedData = assignment.data
        if (typeof parsedData === 'string') {
          try { parsedData = JSON.parse(parsedData) } catch { parsedData = {} }
        }
        
        const resolvedData = await resolveContentData(tenantId, parsedData, singleType.schemaFields)
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

  // Try to find as content entry (default)
  const entry = await db.contentEntry.findFirst({
    where: { id: idOrSlug, tenantId },
    include: { contentType: { include: { schemaFields: true } } },
  })

  if (entry) {
    // Recursively resolve the entry's data
    const resolvedEntryData = await resolveContentData(
      tenantId,
      entry.data as any,
      entry.contentType.schemaFields
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
