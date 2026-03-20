import { db } from "@/lib/database"

/**
 * Resolves a content entry or single type data by resolving its relations and components.
 * This ensures that the dynamic content (like Hero Sections or Related News) is fully
 * populated in the API response.
 */
export async function resolveContentData(
  tenantId: string,
  data: any,
  fields: any[]
): Promise<any> {
  if (!data || !fields || fields.length === 0) return data

  const resolvedData = { ...data }

  for (const field of fields) {
    const value = resolvedData[field.slug]
    if (value === undefined || value === null) continue

    if (field.type === "relation") {
      // Resolve relation (single or multiple)
      if (Array.isArray(value)) {
        resolvedData[field.slug] = await Promise.all(
          value.map((id) => resolveRelation(tenantId, id))
        )
      } else {
        resolvedData[field.slug] = await resolveRelation(tenantId, value)
      }
    } else if (field.type === "component") {
      // Resolve component fields
      const options = typeof field.options === "string" ? JSON.parse(field.options) : field.options
      const componentSlug = options?.componentSlug
      const repeatable = options?.repeatable || false

      if (componentSlug) {
        const component = await db.component.findUnique({
          where: { slug: componentSlug },
          include: { fields: true },
        })

        if (component) {
          if (repeatable && Array.isArray(value)) {
            resolvedData[field.slug] = await Promise.all(
              value.map((item) => resolveContentData(tenantId, item, component.fields))
            )
          } else {
            resolvedData[field.slug] = await resolveContentData(tenantId, value, component.fields)
          }
        }
      }
    }
  }

  return resolvedData
}

/**
 * Resolves a single relation by ID. 
 * Supports both ContentEntry and potentially other SingleTypes if referenced.
 */
async function resolveRelation(tenantId: string, id: string): Promise<any> {
  if (typeof id !== "string") return id

  // Try to find as content entry
  const entry = await db.contentEntry.findFirst({
    where: { id, tenantId },
    include: { contentType: { include: { fields: true } } },
  })

  if (entry) {
    // Recursively resolve the entry's data
    const resolvedEntryData = await resolveContentData(
      tenantId,
      entry.data as any,
      entry.contentType.fields
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
  return id
}
