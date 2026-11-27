/**
 * Shared CMS schema/content introspection logic, extracted from the MCP
 * route (src/app/api/mcp/[[...transport]]/route.ts) to keep the route file's
 * individual tool handlers thin. Every caller resolves its own
 * `tenantDb`/`tenantId` first.
 */

import type { PrismaClient } from "../../prisma/generated-client"

/**
 * chatgpt.md: an AI agent reading content values via query_content/
 * get_content_entry/get_single_type kept rendering richText/markdown
 * fields as plain text on the generated frontend, showing literal <p>/
 * <strong> tags or raw Markdown source to visitors — even though the rule
 * ("render richText as sanitized HTML, markdown through a Markdown
 * renderer") already existed in list_field_types and the agent playbook.
 * Both of those require the agent to have called a SEPARATE tool earlier
 * in the conversation and still remember it when writing display code.
 * Attaching the warning directly alongside the actual field VALUES, in the
 * exact same tool response the agent is already reading, removes that
 * reliance on memory entirely. Returns undefined (omitted from the
 * response) when the content type has no richText/markdown field at all,
 * so this never adds noise to the common case.
 */
export function buildRenderHints(fields: Array<{ slug: string; type: string }> | undefined | null): Record<string, string> | undefined {
  const hints: Record<string, string> = {}
  for (const f of fields || []) {
    if (f.type === "richText") {
      hints[f.slug] = "This value is a raw HTML string. Render it with a sanitized dangerouslySetInnerHTML (or equivalent HTML-aware renderer) — NEVER as plain text/string interpolation, or visitors will see the literal <p>/<strong>/<ul> tags."
    } else if (f.type === "markdown") {
      hints[f.slug] = "This value is raw Markdown source, NOT HTML. Render it through a Markdown renderer (e.g. react-markdown/remark) — showing it as-is displays the raw Markdown syntax to visitors."
    }
  }
  return Object.keys(hints).length > 0 ? hints : undefined
}

function mapFields(fields: any[]) {
  return fields.map((f) => ({
    name: f.name,
    slug: f.slug,
    type: f.type,
    required: f.required,
    unique: f.unique,
    localizable: f.localizable,
    ...(f.relationSlug ? { relationSlug: f.relationSlug } : {}),
    ...(f.options ? { options: f.options } : {}),
  }))
}

export async function getFullSchemaForTenant(
  tenantDb: PrismaClient,
  tenantId: string,
  workspace: { id: string; name: string; slug: string }
) {
  const [contentTypes, singleTypes, components] = await Promise.all([
    tenantDb.contentType.findMany({
      where: { tenantId, draftTemplateId: null },
      include: { schemaFields: { orderBy: { order: "asc" } } },
    }),
    tenantDb.singleType.findMany({
      where: { tenantId, draftTemplateId: null },
      include: {
        schemaFields: { orderBy: { order: "asc" } },
        tenants: { where: { tenantId }, take: 1 },
      },
    }),
    tenantDb.component.findMany({
      where: { tenantId, draftTemplateId: null },
      include: { schemaFields: { orderBy: { order: "asc" } } },
    }),
  ])

  return {
    workspace,
    contentTypes: contentTypes.map((ct) => ({
      id: ct.id,
      name: ct.name,
      slug: ct.slug,
      description: ct.description,
      fields: mapFields(ct.schemaFields),
    })),
    singleTypes: singleTypes.map((st) => ({
      id: st.id,
      name: st.name,
      slug: st.slug,
      description: st.description,
      hasData: !!st.tenants[0]?.data,
      data: st.tenants[0]?.data || null,
      fields: mapFields(st.schemaFields),
    })),
    components: components.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      category: c.category,
      description: c.description,
      fields: mapFields(c.schemaFields),
    })),
  }
}

export async function listContentTypesForTenant(tenantDb: PrismaClient, tenantId: string) {
  const contentTypes = await tenantDb.contentType.findMany({
    where: { tenantId, draftTemplateId: null },
    include: {
      schemaFields: { orderBy: { order: "asc" } },
      _count: { select: { entries: true } },
    },
    orderBy: { name: "asc" },
  })

  return contentTypes.map((ct) => ({
    id: ct.id,
    name: ct.name,
    slug: ct.slug,
    description: ct.description,
    entryCount: ct._count.entries,
    fields: ct.schemaFields.map((f) => ({
      name: f.name,
      slug: f.slug,
      type: f.type,
      required: f.required,
      unique: f.unique,
      relationSlug: f.relationSlug,
      options: f.options,
    })),
  }))
}

export async function getContentTypeForTenant(tenantDb: PrismaClient, tenantId: string, slugOrId: string) {
  const ct = await tenantDb.contentType.findFirst({
    where: {
      draftTemplateId: null,
      OR: [
        { slug: slugOrId, tenantId },
        { id: slugOrId, tenantId },
      ],
    },
    include: {
      schemaFields: { orderBy: { order: "asc" } },
      _count: { select: { entries: true } },
    },
  })

  if (!ct) return null

  return {
    id: ct.id,
    name: ct.name,
    slug: ct.slug,
    description: ct.description,
    showInCms: ct.showInCms,
    entryCount: ct._count.entries,
    fields: ct.schemaFields.map((f) => ({
      id: f.id,
      name: f.name,
      slug: f.slug,
      type: f.type,
      required: f.required,
      unique: f.unique,
      localizable: f.localizable,
      relationSlug: f.relationSlug,
      options: f.options,
    })),
  }
}

export interface QueryContentOptions {
  contentTypeSlug: string
  limit?: number
  page?: number
  status?: "PUBLISHED" | "DRAFT" | "IN_REVIEW" | "ARCHIVED" | "ALL"
  search?: string
  sortOrder?: "asc" | "desc"
}

export async function queryContentForTenant(
  tenantDb: PrismaClient,
  tenantId: string,
  opts: QueryContentOptions
): Promise<Record<string, any> | null> {
  const { contentTypeSlug, limit, page, status, search, sortOrder } = opts

  const ct = await tenantDb.contentType.findFirst({
    where: {
      draftTemplateId: null,
      OR: [
        { slug: contentTypeSlug, tenantId },
        { id: contentTypeSlug, tenantId },
      ],
    },
    include: { schemaFields: true },
  })
  if (!ct) return null

  const renderHints = buildRenderHints(ct.schemaFields)

  const safeLimit = Math.min(limit ?? 10, 100)
  const safePage = Math.max(page ?? 1, 1)
  const safeSortOrder = sortOrder === "asc" ? "ASC" : "DESC"

  let entries: any[]
  let total: number

  const trimmedSearch = search?.trim()
  if (trimmedSearch) {
    // Prisma has no native "search anywhere in this JSON column" filter —
    // same raw-SQL approach the public content API already uses (tsvector
    // first, ILIKE fallback for substrings tsvector's stemming might miss).
    // A real, confirmed bug without this: `search` was accepted by the tool
    // but silently never applied, so a term matching nothing still
    // returned the whole unfiltered, paginated collection.
    const whereParts = [`"contentTypeId" = $1`, `"tenantId" = $2`, `"deletedAt" IS NULL`]
    const params: unknown[] = [ct.id, tenantId]
    let idx = 3
    if (status && status !== "ALL") {
      whereParts.push(`"status"::text = $${idx}`)
      params.push(status)
      idx++
    }
    whereParts.push(`("searchVector" @@ plainto_tsquery('english', $${idx}) OR "data"::text ILIKE $${idx + 1})`)
    params.push(trimmedSearch, `%${trimmedSearch}%`)
    idx += 2
    const whereSql = whereParts.join(" AND ")

    // `SELECT *` would include "searchVector" (an Unsupported("tsvector")
    // column) — Prisma can't deserialize it, so $queryRawUnsafe throws the
    // moment a row is actually returned (a real, confirmed regression: the
    // zero-match case looked fixed since there was nothing to deserialize,
    // but any term that actually matched something broke). Select only
    // the matching ids via raw SQL — used for tsvector filtering/ordering,
    // never returned directly — then re-fetch the real rows through
    // Prisma's own typed client, which already knows to skip Unsupported
    // columns. Same two-step pattern the legacy global content API uses.
    const [idRows, countRows] = await Promise.all([
      tenantDb.$queryRawUnsafe<{ id: string }[]>(
        `SELECT "id" FROM "content_entries" WHERE ${whereSql} ORDER BY "createdAt" ${safeSortOrder} LIMIT $${idx} OFFSET $${idx + 1}`,
        ...params,
        safeLimit,
        (safePage - 1) * safeLimit,
      ),
      tenantDb.$queryRawUnsafe<[{ count: bigint }]>(
        `SELECT COUNT(*) as count FROM "content_entries" WHERE ${whereSql}`,
        ...params,
      ),
    ])
    const matchedIds = idRows.map((r) => r.id)
    const unsortedEntries = matchedIds.length > 0
      ? await tenantDb.contentEntry.findMany({ where: { id: { in: matchedIds } } })
      : []
    // findMany({ id: { in: [...] } }) doesn't preserve the raw query's
    // order — restore it so ORDER BY/pagination still means what it says.
    entries = matchedIds.map((id) => unsortedEntries.find((e) => e.id === id)).filter((e): e is NonNullable<typeof e> => !!e)
    total = Number(countRows[0].count)
  } else {
    const whereClause: any = {
      contentTypeId: ct.id,
      tenantId,
      deletedAt: null,
    }
    if (status && status !== "ALL") {
      whereClause.status = status
    }

    const [rows, count] = await Promise.all([
      tenantDb.contentEntry.findMany({
        where: whereClause,
        skip: (safePage - 1) * safeLimit,
        take: safeLimit,
        orderBy: { createdAt: sortOrder ?? "desc" },
      }),
      tenantDb.contentEntry.count({ where: whereClause }),
    ])
    entries = rows
    total = count
  }

  return {
    contentType: ct.slug,
    ...(renderHints ? { _renderHints: renderHints } : {}),
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.ceil(total / safeLimit),
    },
    data: entries.map((e) => ({
      _id: e.id,
      _status: e.status,
      _createdAt: e.createdAt,
      _publishedAt: e.publishedAt,
      ...(typeof e.data === "object" && e.data !== null ? e.data : {}),
    })),
  }
}

export async function listComponentsForTenant(tenantDb: PrismaClient, tenantId: string) {
  const components = await tenantDb.component.findMany({
    where: { tenantId, draftTemplateId: null },
    include: { schemaFields: { orderBy: { order: "asc" } } },
    orderBy: { name: "asc" },
  })

  return components.map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    category: c.category,
    description: c.description,
    fields: c.schemaFields.map((f) => ({
      name: f.name,
      slug: f.slug,
      type: f.type,
      required: f.required,
      options: f.options,
    })),
  }))
}
