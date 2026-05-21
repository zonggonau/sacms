import { PrismaClient } from "@prisma/client"
import { db } from "@/lib/database"
import { processAutoSlugs } from "@/lib/slug"
import { logAudit, AuditAction } from "@/lib/audit-log"

// Dynamically build GraphQL schema from content types and single types
export async function buildDynamicTypeDefs(
  tenantId: string, 
  includeMutations = false,
  _db: PrismaClient = db
): Promise<string> {
  // Get assigned content types with fields
  const contentTypeAssignments = await _db.tenantContentTypeAssignment.findMany({
    where: { tenantId, enabled: true },
    include: {
      contentType: {
        include: { fields: { orderBy: { order: "asc" } } },
      },
    },
  })

  // Get assigned single types with fields
  const singleTypeAssignments = await _db.tenantSingleTypeAssignment.findMany({
    where: { tenantId, enabled: true },
    include: {
      singleType: {
        include: { fields: { orderBy: { order: "asc" } } },
      },
    },
  })

  const typeDefinitions: string[] = []
  const queryFields: string[] = []
  const mutationFields: string[] = []
  const contentTypeSlugs: string[] = []

  // Generate types for each content type
  for (const assignment of contentTypeAssignments) {
    const ct = assignment.contentType
    const typeName = toPascalCase(ct.slug)
    contentTypeSlugs.push(ct.slug)
    const fields = ct.fields
      .map((f) => `  ${sanitizeFieldName(f.slug)}: ${mapFieldTypeToGraphQL(f.type, f.required)}`)
      .join("\n")

    typeDefinitions.push(`
type ${typeName} {
  id: ID!
  locale: String
  status: String
  publishedAt: String
  createdAt: String!
  updatedAt: String!
${fields}
}

type ${typeName}Collection {
  data: [${typeName}!]!
  meta: CollectionMeta!
}`)

    queryFields.push(
      `  ${sanitizeFieldName(ct.slug)}(page: Int, limit: Int, sort: String, order: String, published: Boolean, locale: String, status: String): ${typeName}Collection`,
      `  ${sanitizeFieldName(ct.slug)}ById(id: ID!): ${typeName}`
    )

    if (includeMutations) {
      mutationFields.push(
        `  create${typeName}(data: JSON!, locale: String, status: String): ${typeName}`,
        `  update${typeName}(id: ID!, data: JSON!): ${typeName}`,
        `  delete${typeName}(id: ID!): DeleteResult!`,
        `  publish${typeName}(id: ID!): ${typeName}`
      )
    }
  }

  // Generate types for each single type
  for (const assignment of singleTypeAssignments) {
    const st = assignment.singleType
    const typeName = toPascalCase(st.slug) + "Single"
    const fields = st.fields
      .map((f) => `  ${sanitizeFieldName(f.slug)}: ${mapFieldTypeToGraphQL(f.type, f.required)}`)
      .join("\n")

    typeDefinitions.push(`
type ${typeName} {
  publishedAt: String
  updatedAt: String
${fields}
}`)

    queryFields.push(`  ${sanitizeFieldName(st.slug)}(locale: String): ${typeName}`)
  }

  return `
scalar JSON

type CollectionMeta {
  page: Int!
  limit: Int!
  total: Int!
  totalPages: Int!
}

type DeleteResult {
  id: ID!
  success: Boolean!
}

${typeDefinitions.join("\n")}

type Query {
${queryFields.length > 0 ? queryFields.join("\n") : "  _empty: String"}
}
${includeMutations && mutationFields.length > 0 ? `
type Mutation {
${mutationFields.join("\n")}
}
` : ""}
`
}

// Build resolvers dynamically
export function buildDynamicResolvers(tenantId: string, _db: PrismaClient = db) {
  return {
    Query: new Proxy(
      {},
      {
        get(_target, prop: string) {
          // Check if it's a "byId" query
          if (prop.endsWith("ById")) {
            const sanitizedSlug = prop.replace("ById", "")
            return async (_parent: unknown, args: { id: string }, context: any) => {
              // Find content type that matches sanitized slug
              const allContentTypes = await _db.contentType.findMany({
                where: { 
                  OR: [
                    { tenantId },
                    { tenantId: null, tenants: { some: { tenantId, enabled: true } } }
                  ]
                }
              })
              const ct = allContentTypes.find(c => sanitizeFieldName(c.slug) === sanitizedSlug)
              if (!ct) return null
              return resolveContentEntryById(tenantId, ct.slug, args.id, _db, context)
            }
          }
          // Otherwise it could be a collection query or single type
          return async (
            _parent: unknown,
            args: { page?: number; limit?: number; sort?: string; order?: string; published?: boolean; locale?: string; status?: string },
            context: any
          ) => {
            // Fetch all assigned content types and single types to find match by sanitized name
            const [contentTypes, singleTypes] = await Promise.all([
              _db.contentType.findMany({
                where: { 
                  OR: [
                    { tenantId },
                    { tenantId: null, tenants: { some: { tenantId, enabled: true } } }
                  ]
                },
              }),
              _db.singleType.findMany({
                where: { 
                  OR: [
                    { tenantId },
                    { tenantId: null, tenants: { some: { tenantId, enabled: true } } }
                  ]
                },
              })
            ])

            const ct = contentTypes.find(c => sanitizeFieldName(c.slug) === prop)
            if (ct) {
              return resolveContentCollection(tenantId, ct.id, args, _db, context)
            }

            const st = singleTypes.find(s => sanitizeFieldName(s.slug) === prop)
            if (st) {
              return resolveSingleType(tenantId, st.slug, _db, args.locale)
            }

            return null
          }
        },
      }
    ),
    Mutation: new Proxy(
      {},
      {
        get(_target, prop: string) {
          // create{TypeName}
          if (prop.startsWith("create")) {
            const slug = toSlug(prop.replace("create", ""))
            return async (_parent: unknown, args: { data: any; locale?: string; status?: string }) => {
              return resolveMutationCreate(tenantId, slug, args, _db)
            }
          }
          // update{TypeName}
          if (prop.startsWith("update")) {
            const slug = toSlug(prop.replace("update", ""))
            return async (_parent: unknown, args: { id: string; data: any }) => {
              return resolveMutationUpdate(tenantId, slug, args, _db)
            }
          }
          // delete{TypeName}
          if (prop.startsWith("delete")) {
            const slug = toSlug(prop.replace("delete", ""))
            return async (_parent: unknown, args: { id: string }) => {
              return resolveMutationDelete(tenantId, slug, args.id, _db)
            }
          }
          // publish{TypeName}
          if (prop.startsWith("publish")) {
            const slug = toSlug(prop.replace("publish", ""))
            return async (_parent: unknown, args: { id: string }) => {
              return resolveMutationPublish(tenantId, slug, args.id, _db)
            }
          }
          return null
        },
      }
    ),
  }
}

async function resolveContentCollection(
  tenantId: string,
  contentTypeId: string,
  args: { page?: number; limit?: number; sort?: string; order?: string; published?: boolean; locale?: string; status?: string } = {},
  _db: PrismaClient = db,
  context?: any
) {
  const page = args?.page ?? 1
  const limit = Math.min(args?.limit ?? 25, 100)
  const sort = args?.sort ?? "createdAt"
  const order = args?.order ?? "desc"

  const where: any = {
    contentTypeId,
    tenantId,
    status: args?.status ?? "PUBLISHED",
  }
  if (args?.locale) where.locale = args.locale
  // Legacy support: published=false returns all statuses
  if (args?.published === false) delete where.status

  const [total, entries] = await Promise.all([
    _db.contentEntry.count({ where }),
    _db.contentEntry.findMany({
      where,
      orderBy: { [sort]: order },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ])

  let fieldsToPopulate: string[] = []
  if (context?.loaders?.entryLoader) {
    const ct = await _db.contentType.findUnique({ where: { id: contentTypeId }, include: { fields: true } })
    if (ct) {
      fieldsToPopulate = ct.fields.filter(f => f.type === 'relation').map(f => f.slug)
    }
  }

  const data = await Promise.all(entries.map(async (entry) => {
    let parsedData: any = typeof entry.data === 'string' ? JSON.parse(entry.data) : (entry.data || {})

    if (fieldsToPopulate.length > 0 && context?.loaders?.entryLoader) {
      for (const fieldSlug of fieldsToPopulate) {
        const val = parsedData[fieldSlug]
        if (typeof val === 'string') {
          const rel = await context.loaders.entryLoader.load(val)
          if (rel) parsedData[fieldSlug] = { id: rel.id, ...(typeof rel.data === 'string' ? JSON.parse(rel.data) : rel.data) }
        } else if (Array.isArray(val)) {
          const rels = await Promise.all(val.map(id => typeof id === 'string' ? context.loaders.entryLoader.load(id) : null))
          parsedData[fieldSlug] = rels.filter(Boolean).map((rel: any) => ({ id: rel.id, ...(typeof rel.data === 'string' ? JSON.parse(rel.data) : rel.data) }))
        }
      }
    }

    return {
      id: entry.id,
      ...parsedData,
      locale: entry.locale,
      status: entry.status,
      publishedAt: entry.publishedAt?.toISOString() ?? null,
      createdAt: entry.createdAt.toISOString(),
      updatedAt: entry.updatedAt.toISOString(),
    }
  }))

  return {
    data,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  }
}

async function resolveContentEntryById(tenantId: string, slug: string, id: string, _db: PrismaClient = db, context?: any) {
  const contentType = await _db.contentType.findFirst({
    where: { 
      slug,
      OR: [
        { tenantId },
        { tenantId: null, tenants: { some: { tenantId, enabled: true } } }
      ]
    }
  })
  if (!contentType) return null

  const entry = await _db.contentEntry.findFirst({
    where: { id, contentTypeId: contentType.id, tenantId },
  })
  if (!entry) return null

  let parsedData: any = typeof entry.data === 'string' ? JSON.parse(entry.data) : (entry.data || {})

  if (context?.loaders?.entryLoader) {
    const fieldsToPopulate = contentType.fields?.filter(f => f.type === 'relation').map(f => f.slug) || []
    for (const fieldSlug of fieldsToPopulate) {
      const val = parsedData[fieldSlug]
      if (typeof val === 'string') {
        const rel = await context.loaders.entryLoader.load(val)
        if (rel) parsedData[fieldSlug] = { id: rel.id, ...(typeof rel.data === 'string' ? JSON.parse(rel.data) : rel.data) }
      } else if (Array.isArray(val)) {
        const rels = await Promise.all(val.map(id => typeof id === 'string' ? context.loaders.entryLoader.load(id) : null))
        parsedData[fieldSlug] = rels.filter(Boolean).map((rel: any) => ({ id: rel.id, ...(typeof rel.data === 'string' ? JSON.parse(rel.data) : rel.data) }))
      }
    }
  }

  return {
    id: entry.id,
    ...parsedData,
    locale: entry.locale,
    status: entry.status,
    publishedAt: entry.publishedAt?.toISOString() ?? null,
    createdAt: entry.createdAt.toISOString(),
    updatedAt: entry.updatedAt.toISOString(),
  }
}

async function resolveMutationCreate(
  tenantId: string,
  slug: string,
  args: { data: any; locale?: string; status?: string },
  _db: PrismaClient = db,
  userId?: string // Optional: track who made the change
) {
  const contentType = await _db.contentType.findFirst({
    where: { 
      slug,
      OR: [
        { tenantId },
        { tenantId: null, tenants: { some: { tenantId, enabled: true } } }
      ]
    },
    include: { fields: true }
  })
  if (!contentType) throw new Error(`Content type '${slug}' not found`)

  const dataWithSlugs = await processAutoSlugs(
    tenantId,
    contentType.id,
    contentType.fields,
    args.data,
    undefined,
    'collection',
    _db
  )

  const entry = await _db.$transaction(async (tx) => {
    const newEntry = await tx.contentEntry.create({
      data: {
        contentTypeId: contentType.id,
        tenantId,
        data: dataWithSlugs as any,
        locale: args.locale ?? "en",
        status: (args.status as any) ?? "DRAFT",
        createdBy: userId,
      },
    })

    // Set documentId to the same as id for the first version
    const updated = await tx.contentEntry.update({
      where: { id: newEntry.id },
      data: { documentId: newEntry.id }
    })

    return updated
  })

  logAudit({
    tenantId,
    userId,
    action: AuditAction.CONTENT_CREATED,
    entity: "ContentEntry",
    entityId: entry.id,
    data: { contentType: slug, source: "graphql" }
  })

  return {
    id: entry.id,
    ...(entry.data as any),
    locale: entry.locale,
    status: entry.status,
    publishedAt: entry.publishedAt?.toISOString() ?? null,
    createdAt: entry.createdAt.toISOString(),
    updatedAt: entry.updatedAt.toISOString(),
  }
}

async function resolveMutationUpdate(
  tenantId: string,
  slug: string,
  args: { id: string; data: any },
  _db: PrismaClient = db,
  userId?: string
) {
  const contentType = await _db.contentType.findFirst({
    where: { 
      slug,
      OR: [
        { tenantId },
        { tenantId: null, tenants: { some: { tenantId, enabled: true } } }
      ]
    },
    include: { fields: true }
  })
  if (!contentType) throw new Error(`Content type '${slug}' not found`)

  const existing = await _db.contentEntry.findFirst({
    where: { id: args.id, contentTypeId: contentType.id, tenantId },
  })
  if (!existing) throw new Error("Entry not found")

  const fullData = { ...(existing.data as any), ...args.data }
  const dataWithSlugs = await processAutoSlugs(
    tenantId,
    contentType.id,
    contentType.fields,
    fullData,
    args.id,
    'collection',
    _db
  )

  const updated = await _db.contentEntry.update({
    where: { id: args.id },
    data: { 
      data: dataWithSlugs as any, 
      updatedBy: userId,
      updatedAt: new Date() 
    },
  })

  logAudit({
    tenantId,
    userId,
    action: AuditAction.CONTENT_UPDATED,
    entity: "ContentEntry",
    entityId: updated.id,
    data: { contentType: slug, source: "graphql" }
  })

  return {
    id: updated.id,
    ...(updated.data as any),
    locale: updated.locale,
    status: updated.status,
    publishedAt: updated.publishedAt?.toISOString() ?? null,
    createdAt: updated.createdAt.toISOString(),
    updatedAt: updated.updatedAt.toISOString(),
  }
}

async function resolveMutationDelete(
  tenantId: string, 
  slug: string, 
  id: string, 
  _db: PrismaClient = db,
  userId?: string
) {
  const contentType = await _db.contentType.findFirst({
    where: { 
      slug,
      OR: [
        { tenantId },
        { tenantId: null, tenants: { some: { tenantId, enabled: true } } }
      ]
    }
  })
  if (!contentType) throw new Error(`Content type '${slug}' not found`)

  const existing = await _db.contentEntry.findFirst({
    where: { id, contentTypeId: contentType.id, tenantId },
  })
  if (!existing) throw new Error("Entry not found")

  await _db.contentEntry.delete({ where: { id } })

  logAudit({
    tenantId,
    userId,
    action: AuditAction.CONTENT_DELETED,
    entity: "ContentEntry",
    entityId: id,
    data: { contentType: slug, source: "graphql" }
  })

  return { id, success: true }
}

async function resolveMutationPublish(
  tenantId: string, 
  slug: string, 
  id: string, 
  _db: PrismaClient = db,
  userId?: string
) {
  const contentType = await _db.contentType.findFirst({
    where: { 
      slug,
      OR: [
        { tenantId },
        { tenantId: null, tenants: { some: { tenantId, enabled: true } } }
      ]
    }
  })
  if (!contentType) throw new Error(`Content type '${slug}' not found`)

  const existing = await _db.contentEntry.findFirst({
    where: { id, contentTypeId: contentType.id, tenantId },
  })
  if (!existing) throw new Error("Entry not found")

  const updated = await _db.contentEntry.update({
    where: { id },
    data: {
      status: "PUBLISHED",
      publishedAt: new Date(),
      updatedBy: userId,
    },
  })

  logAudit({
    tenantId,
    userId,
    action: AuditAction.CONTENT_PUBLISHED,
    entity: "ContentEntry",
    entityId: updated.id,
    data: { contentType: slug, source: "graphql" }
  })

  return {
    id: updated.id,
    ...(updated.data as any),
    locale: updated.locale,
    status: updated.status,
    publishedAt: updated.publishedAt?.toISOString() ?? null,
    createdAt: updated.createdAt.toISOString(),
    updatedAt: updated.updatedAt.toISOString(),
  }
}

async function resolveSingleType(
  tenantId: string,
  slug: string,
  _db: PrismaClient = db,
  locale?: string
) {
  const singleType = await _db.singleType.findFirst({
    where: { 
      slug,
      OR: [
        { tenantId },
        { tenantId: null, tenants: { some: { tenantId, enabled: true } } }
      ]
    }
  })
  if (!singleType) return null

  // Resolve locale: use arg → tenant default → "en"
  let resolvedLocale = locale
  if (!resolvedLocale) {
    const defaultLocale = await _db.tenantLocale.findFirst({
      where: { tenantId, isDefault: true },
      select: { locale: true },
    })
    resolvedLocale = defaultLocale?.locale ?? "en"
  }

  // Try requested locale first, then fall back to "en"
  let assignment = await _db.tenantSingleTypeAssignment.findUnique({
    where: {
      tenantId_singleTypeId_locale: { 
        tenantId, 
        singleTypeId: singleType.id,
        locale: resolvedLocale,
      },
    },
  })

  // Fallback to default locale if no data found for requested locale
  if ((!assignment || !assignment.data) && resolvedLocale !== "en") {
    assignment = await _db.tenantSingleTypeAssignment.findUnique({
      where: {
        tenantId_singleTypeId_locale: { 
          tenantId, 
          singleTypeId: singleType.id,
          locale: "en",
        },
      },
    })
  }

  if (!assignment || !assignment.data) return null

  return {
    ...(typeof assignment.data === 'string' ? JSON.parse(assignment.data) : assignment.data),
    publishedAt: assignment.publishedAt?.toISOString() ?? null,
    updatedAt: assignment.updatedAt.toISOString(),
  }
}

// Helpers

function toPascalCase(slug: string): string {
  return slug
    .split(/[-_]/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join("")
}

/** Reverse of toPascalCase — convert PascalCase back to kebab-case slug */
function toSlug(pascal: string): string {
  return pascal
    .replace(/([A-Z])/g, (m, l, offset) => (offset > 0 ? "-" : "") + l.toLowerCase())
    .replace(/^-/, "")
}

function sanitizeFieldName(slug: string): string {
  return slug.replace(/[-]/g, "_")
}

function mapFieldTypeToGraphQL(fieldType: string, required: boolean): string {
  const base = (() => {
    switch (fieldType) {
      case "text":
      case "textarea":
      case "richText":
      case "email":
      case "password":
      case "uid":
      case "color":
      case "date":
      case "time":
      case "datetime":
      case "timestamp":
      case "enumeration":
      case "select":
        return "String"
      case "integer":
      case "biginteger":
        return "Int"
      case "decimal":
      case "float":
        return "Float"
      case "boolean":
        return "Boolean"
      case "json":
      case "location":
      case "component":
      case "media":
        return "JSON"
      case "mediaMultiple":
        return "[JSON]"
      case "relation":
        return "JSON"
      default:
        return "String"
    }
  })()
  return required ? `${base}!` : base
}
