/**
 * Shared CMS schema/content introspection logic.
 *
 * Extracted from the MCP route (src/app/api/mcp/[[...transport]]/route.ts)
 * so the same query logic can be reused in-process by AI Site's tool-calling
 * agent (src/lib/ai-site/tools.ts) without an HTTP loopback or a second auth
 * hop. Both callers resolve their own `tenantDb`/`tenantId` first.
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
  const { contentTypeSlug, limit, page, status, locale, sortOrder } = opts

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

  const whereClause: any = {
    contentTypeId: ct.id,
    tenantId,
  }
  if (status && status !== "ALL") {
    whereClause.status = status
  }
  if (locale) {
    whereClause.locale = locale
  }

  const [entries, total] = await Promise.all([
    tenantDb.contentEntry.findMany({
      where: whereClause,
      skip: (safePage - 1) * safeLimit,
      take: safeLimit,
      orderBy: { createdAt: sortOrder ?? "desc" },
    }),
    tenantDb.contentEntry.count({ where: whereClause }),
  ])

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
