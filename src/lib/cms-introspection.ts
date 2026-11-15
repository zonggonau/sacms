/**
 * Shared CMS schema/content introspection logic, extracted from the MCP
 * route (src/app/api/mcp/[[...transport]]/route.ts) to keep the route file's
 * individual tool handlers thin. Every caller resolves its own
 * `tenantDb`/`tenantId` first.
 */

import type { PrismaClient } from "../../prisma/generated-client"

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
  locale?: string
  sortOrder?: "asc" | "desc"
}

export async function queryContentForTenant(
  tenantDb: PrismaClient,
  tenantId: string,
  opts: QueryContentOptions
): Promise<Record<string, any> | null> {
  const { contentTypeSlug, limit, page, status, search, locale, sortOrder } = opts

  const ct = await tenantDb.contentType.findFirst({
    where: {
      draftTemplateId: null,
      OR: [
        { slug: contentTypeSlug, tenantId },
        { id: contentTypeSlug, tenantId },
      ],
    },
  })
  if (!ct) return null

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
    if (locale) {
      whereParts.push(`"locale" = $${idx}`)
      params.push(locale)
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
    if (locale) {
      whereClause.locale = locale
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
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.ceil(total / safeLimit),
    },
    data: entries.map((e) => ({
      _id: e.id,
      _status: e.status,
      _locale: e.locale,
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
