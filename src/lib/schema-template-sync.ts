import type { PrismaClient, Prisma } from "../../prisma/generated-client"
import { slugify } from "@/lib/slug"

const MAX_GROUP_DEPTH = 2 // 0-indexed — matches content-type-group-service.ts's "up to 3 levels"

/**
 * Shared JSON<->real-rows conversion for `{contentTypes, singleTypes,
 * components}` schema blobs. Both directions were originally written
 * standalone in import-schema/route.ts and export-schema/route.ts; they're
 * extracted here so Schema Template materialization/snapshot (see
 * api/tenant/[tenant]/schema-templates/[id]/materialize and sync) can reuse
 * the exact same logic instead of a parallel copy.
 */

interface SchemaFieldInput {
  name: string
  slug: string
  type: string
  required?: boolean
  unique?: boolean
  relationSlug?: string
  componentSlug?: string
  /** Generic per-type extras — select/multiselect's { choices: [...] },
   *  currency's { currencyCode }, etc. `componentSlug` above is really
   *  just `options.componentSlug` under an older, narrower convenience
   *  name; both directions below reconcile the two. */
  options?: Record<string, unknown>
}

interface SchemaModelInput {
  name: string
  slug: string
  description?: string
  fields?: SchemaFieldInput[]
  /** Content Types only — references `groups[].slug` below. Ignored for
   *  singleTypes/components (no grouping concept exists for those). */
  group?: string
}

interface SchemaGroupInput {
  /** Template-local synthetic key — NOT a real ContentTypeGroup id, those
   *  only exist once materialized into a real tenant. */
  slug: string
  name: string
  parentSlug?: string
}

export interface SchemaBlob {
  groups?: SchemaGroupInput[]
  contentTypes?: SchemaModelInput[]
  singleTypes?: SchemaModelInput[]
  components?: SchemaModelInput[]
}

export function fieldsToCreateInput(fields: SchemaFieldInput[] | undefined) {
  return (fields || []).map((f, i) => {
    const options: Record<string, unknown> | undefined =
      f.options ?? (f.type === "component" && f.componentSlug ? { componentSlug: f.componentSlug } : undefined)
    return {
      name: f.name,
      slug: f.slug,
      type: f.type,
      required: !!f.required,
      unique: !!f.unique,
      order: i,
      relationSlug: f.type === "relation" ? f.relationSlug : null,
      options: options as any,
    }
  })
}

/**
 * Creates ContentType/SingleType/Component + SchemaField rows from a schema
 * blob for the given tenant, skipping any model whose slug already exists.
 * `extraData` is merged into every created model's top-level `data` — used
 * to stamp `draftTemplateId` for template materialization; omit it for a
 * normal tenant import.
 *
 * Runs as one interactive transaction so a failure partway through (e.g. a
 * slug collision from a concurrent request) rolls back everything already
 * created in this call instead of leaving the tenant with a half-imported
 * schema and no way to tell which models landed.
 */
export async function materializeSchemaIntoTenant(
  tenantDb: PrismaClient,
  tenantId: string,
  schema: SchemaBlob,
  extraData: Record<string, unknown> = {},
): Promise<{ imported: number }> {
  return tenantDb.$transaction(async (tx) => {
    let imported = 0

    // ── Groups first, so contentTypes below can resolve `group` (a
    // template-local slug) to a real groupId. Processes `schema.groups` IN
    // ARRAY ORDER — list a parent before its children, same requirement
    // documented on schemaTemplateGroupSchema. Reuses an existing group
    // with the same name+parent instead of creating a duplicate, so
    // materializing the same template twice (e.g. toggling a template
    // Draft on/off) doesn't pile up repeat folders. Depth exceeding the
    // 3-level cap silently flattens to top-level rather than failing the
    // whole import — same "best effort, skip what doesn't fit" philosophy
    // already used below for a slug collision.
    const groupSlugToId = new Map<string, string>()
    const groupSlugToDepth = new Map<string, number>()
    const groupOrderCounters = new Map<string, number>()

    for (const g of schema.groups || []) {
      if (!g.slug || !g.name) continue
      const parentId = g.parentSlug ? groupSlugToId.get(g.parentSlug) ?? null : null
      const parentDepth = g.parentSlug ? groupSlugToDepth.get(g.parentSlug) ?? -1 : -1
      const resolvedParentId = parentDepth + 1 > MAX_GROUP_DEPTH ? null : parentId
      const depth = resolvedParentId ? parentDepth + 1 : 0

      const existingGroup = await tx.contentTypeGroup.findFirst({
        where: { tenantId, name: g.name, parentId: resolvedParentId },
      })

      let groupId: string
      if (existingGroup) {
        groupId = existingGroup.id
      } else {
        const orderKey = resolvedParentId ?? "__root__"
        const order = groupOrderCounters.get(orderKey) ?? await tx.contentTypeGroup.count({
          where: { tenantId, parentId: resolvedParentId },
        })
        groupOrderCounters.set(orderKey, order + 1)

        const created = await tx.contentTypeGroup.create({
          data: { tenantId, name: g.name, parentId: resolvedParentId, order },
        })
        groupId = created.id
      }
      groupSlugToId.set(g.slug, groupId)
      groupSlugToDepth.set(g.slug, depth)
    }

    const contentTypeGroupOrderCounters = new Map<string, number>()
    const resolveContentTypeGroup = async (groupSlug: string | undefined): Promise<{ groupId: string | null; groupOrder: number }> => {
      if (!groupSlug) return { groupId: null, groupOrder: 0 }
      const groupId = groupSlugToId.get(groupSlug) ?? null
      if (!groupId) return { groupId: null, groupOrder: 0 }
      const groupOrder = contentTypeGroupOrderCounters.get(groupId) ?? await tx.contentType.count({ where: { groupId } })
      contentTypeGroupOrderCounters.set(groupId, groupOrder + 1)
      return { groupId, groupOrder }
    }

    for (const ct of schema.contentTypes || []) {
      if (!ct.slug || !ct.name) continue
      const exists = await tx.contentType.findFirst({ where: { slug: ct.slug, tenantId } })
      if (exists) continue
      const { groupId, groupOrder } = await resolveContentTypeGroup(ct.group)
      await tx.contentType.create({
        data: {
          tenantId,
          name: ct.name,
          slug: ct.slug,
          description: ct.description || "",
          isPublished: true,
          groupId,
          groupOrder,
          schemaFields: { create: fieldsToCreateInput(ct.fields) },
          tenants: { create: { tenantId } },
          ...extraData,
        },
      })
      imported++
    }

    for (const st of schema.singleTypes || []) {
      if (!st.slug || !st.name) continue
      const exists = await tx.singleType.findFirst({ where: { slug: st.slug, tenantId } })
      if (exists) continue
      await tx.singleType.create({
        data: {
          tenantId,
          name: st.name,
          slug: st.slug,
          description: st.description || "",
          isPublished: true,
          schemaFields: { create: fieldsToCreateInput(st.fields) },
          tenants: { create: { tenantId } },
          ...extraData,
        },
      })
      imported++
    }

    for (const comp of schema.components || []) {
      if (!comp.slug || !comp.name) continue
      const exists = await tx.component.findFirst({ where: { slug: comp.slug, tenantId } })
      if (exists) continue
      await tx.component.create({
        data: {
          tenantId,
          name: comp.name,
          slug: comp.slug,
          description: comp.description || "",
          schemaFields: { create: fieldsToCreateInput(comp.fields) },
          tenants: { create: { tenantId } },
          ...extraData,
        },
      })
      imported++
    }

    return { imported }
  }, { timeout: 20000 })
}

export function formatFields(fields: { name: string; slug: string; type: string; required: boolean; unique: boolean; relationSlug: string | null; options: unknown }[]) {
  return fields.map((f) => {
    const fieldData: SchemaFieldInput = {
      name: f.name,
      slug: f.slug,
      type: f.type,
      required: f.required,
      unique: f.unique,
    }
    if (f.relationSlug) fieldData.relationSlug = f.relationSlug
    const opts = f.options as Record<string, unknown> | null | undefined
    if (opts && Object.keys(opts).length > 0) {
      fieldData.options = opts
      if (typeof opts.componentSlug === "string") fieldData.componentSlug = opts.componentSlug
    }
    return fieldData
  })
}

/**
 * Serializes a tenant's (or a tagged subset of a tenant's) Content
 * Types/Single Types/Components + fields back into the same
 * `{contentTypes, singleTypes, components}` shape materializeSchemaIntoTenant
 * consumes. `where` lets callers scope to a draft template's tagged rows
 * instead of the whole tenant.
 */
export async function serializeTenantSchema(
  tenantDb: PrismaClient,
  where: Prisma.ContentTypeWhereInput & Prisma.SingleTypeWhereInput & Prisma.ComponentWhereInput,
) {
  const [contentTypes, singleTypes, components] = await Promise.all([
    tenantDb.contentType.findMany({ where, include: { schemaFields: { orderBy: { order: "asc" } } } }),
    tenantDb.singleType.findMany({ where, include: { schemaFields: { orderBy: { order: "asc" } } } }),
    tenantDb.component.findMany({ where, include: { schemaFields: { orderBy: { order: "asc" } } } }),
  ])

  // Reconstruct the group hierarchy these Content Types actually reference
  // — only the groups in use (plus their ancestors, so the nesting isn't
  // broken), not every group in the tenant. `tenantId` is always a plain
  // field on `where` at both real call sites (export-schema/route.ts and
  // schema-templates/[id]/route.ts).
  const tenantId = (where as { tenantId?: string }).tenantId
  const usedGroupIds = new Set(contentTypes.map((ct) => ct.groupId).filter((id): id is string => !!id))
  const groupSlugs = new Map<string, string>() // real groupId -> synthetic template-local slug
  const groupsOut: { slug: string; name: string; parentSlug?: string }[] = []

  if (tenantId && usedGroupIds.size > 0) {
    const allGroups = await tenantDb.contentTypeGroup.findMany({
      where: { tenantId },
      select: { id: true, name: true, parentId: true, order: true },
    })
    const byId = new Map(allGroups.map((g) => [g.id, g]))

    const include = new Set<string>()
    for (const id of usedGroupIds) {
      let current: string | undefined = id
      while (current && !include.has(current)) {
        include.add(current)
        current = byId.get(current)?.parentId ?? undefined
      }
    }

    const depthOf = (id: string): number => {
      let d = 0
      let current = byId.get(id)
      while (current?.parentId) {
        d++
        current = byId.get(current.parentId)
      }
      return d
    }
    // Parents before children (materialize's own requirement) — sort by
    // depth first, then original sibling order.
    const ordered = [...include].sort((a, b) => {
      const diff = depthOf(a) - depthOf(b)
      return diff !== 0 ? diff : (byId.get(a)?.order ?? 0) - (byId.get(b)?.order ?? 0)
    })

    const usedSlugs = new Set<string>()
    for (const id of ordered) {
      const g = byId.get(id)!
      const base = slugify(g.name) || "group"
      let slug = base
      let suffix = 1
      while (usedSlugs.has(slug)) slug = `${base}-${++suffix}`
      usedSlugs.add(slug)
      groupSlugs.set(id, slug)

      const parentSlug = g.parentId ? groupSlugs.get(g.parentId) : undefined
      groupsOut.push({ slug, name: g.name, ...(parentSlug ? { parentSlug } : {}) })
    }
  }

  return {
    groups: groupsOut,
    contentTypes: contentTypes.map((ct) => ({
      name: ct.name,
      slug: ct.slug,
      description: ct.description,
      fields: formatFields(ct.schemaFields),
      ...(ct.groupId && groupSlugs.has(ct.groupId) ? { group: groupSlugs.get(ct.groupId) } : {}),
    })),
    singleTypes: singleTypes.map((st) => ({
      name: st.name,
      slug: st.slug,
      description: st.description,
      fields: formatFields(st.schemaFields),
    })),
    components: components.map((comp) => ({
      name: comp.name,
      slug: comp.slug,
      description: comp.description,
      fields: formatFields(comp.schemaFields),
    })),
  }
}
