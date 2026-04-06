import { db } from "@/lib/database"
import { processAutoSlugs } from "@/lib/slug"

// Dynamically build GraphQL schema from content types and single types
export async function buildDynamicTypeDefs(tenantId: string, includeMutations = false): Promise<string> {
  // Get assigned content types with fields
  const contentTypeAssignments = await db.tenantContentTypeAssignment.findMany({
    where: { tenantId, enabled: true },
    include: {
      contentType: {
        include: { fields: { orderBy: { order: "asc" } } },
      },
    },
  })

  // Get assigned single types with fields
  const singleTypeAssignments = await db.tenantSingleTypeAssignment.findMany({
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
      `  ${ct.slug}(page: Int, limit: Int, sort: String, order: String, published: Boolean, locale: String, status: String): ${typeName}Collection`,
      `  ${ct.slug}ById(id: ID!): ${typeName}`
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

    queryFields.push(`  ${st.slug}: ${typeName}`)
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
${queryFields.join("\n")}
}
${includeMutations && mutationFields.length > 0 ? `
type Mutation {
${mutationFields.join("\n")}
}
` : ""}
`
}

// Build resolvers dynamically
export function buildDynamicResolvers(tenantId: string) {
  return {
    Query: new Proxy(
      {},
      {
        get(_target, prop: string) {
          // Check if it's a "byId" query
          if (prop.endsWith("ById")) {
            const slug = prop.replace("ById", "")
            return async (_parent: unknown, args: { id: string }) => {
              return resolveContentEntryById(tenantId, slug, args.id)
            }
          }
          // Otherwise it could be a collection query or single type
          return async (
            _parent: unknown,
            args: { page?: number; limit?: number; sort?: string; order?: string; published?: boolean; locale?: string; status?: string }
          ) => {
            // Try as content type first
            const contentType = await db.contentType.findFirst({
              where: { 
                slug: prop,
                OR: [
                  { tenantId },
                  { tenantId: null, tenants: { some: { tenantId, enabled: true } } }
                ]
              },
            })
            if (contentType) {
              return resolveContentCollection(tenantId, contentType.id, args)
            }
            // Try as single type
            return resolveSingleType(tenantId, prop)
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
              return resolveMutationCreate(tenantId, slug, args)
            }
          }
          // update{TypeName}
          if (prop.startsWith("update")) {
            const slug = toSlug(prop.replace("update", ""))
            return async (_parent: unknown, args: { id: string; data: any }) => {
              return resolveMutationUpdate(tenantId, slug, args)
            }
          }
          // delete{TypeName}
          if (prop.startsWith("delete")) {
            const slug = toSlug(prop.replace("delete", ""))
            return async (_parent: unknown, args: { id: string }) => {
              return resolveMutationDelete(tenantId, slug, args.id)
            }
          }
          // publish{TypeName}
          if (prop.startsWith("publish")) {
            const slug = toSlug(prop.replace("publish", ""))
            return async (_parent: unknown, args: { id: string }) => {
              return resolveMutationPublish(tenantId, slug, args.id)
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
  args: { page?: number; limit?: number; sort?: string; order?: string; published?: boolean; locale?: string; status?: string }
) {
  const page = args.page ?? 1
  const limit = Math.min(args.limit ?? 25, 100)
  const sort = args.sort ?? "createdAt"
  const order = args.order ?? "desc"

  const where: any = {
    contentTypeId,
    tenantId,
    status: args.status ?? "PUBLISHED",
  }
  if (args.locale) where.locale = args.locale
  // Legacy support: published=false returns all statuses
  if (args.published === false) delete where.status

  const [total, entries] = await Promise.all([
    db.contentEntry.count({ where }),
    db.contentEntry.findMany({
      where,
      orderBy: { [sort]: order },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ])

  const data = entries.map((entry) => ({
    id: entry.id,
    ...(entry.data as any),
    locale: entry.locale,
    status: entry.status,
    publishedAt: entry.publishedAt?.toISOString() ?? null,
    createdAt: entry.createdAt.toISOString(),
    updatedAt: entry.updatedAt.toISOString(),
  }))

  return {
    data,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  }
}

async function resolveContentEntryById(tenantId: string, slug: string, id: string) {
  const contentType = await db.contentType.findFirst({
    where: { 
      slug,
      OR: [
        { tenantId },
        { tenantId: null, tenants: { some: { tenantId, enabled: true } } }
      ]
    }
  })
  if (!contentType) return null

  const entry = await db.contentEntry.findFirst({
    where: { id, contentTypeId: contentType.id, tenantId },
  })
  if (!entry) return null

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

async function resolveMutationCreate(
  tenantId: string,
  slug: string,
  args: { data: any; locale?: string; status?: string }
) {
  const contentType = await db.contentType.findFirst({
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
    args.data
  )

  const entry = await db.contentEntry.create({
    data: {
      contentTypeId: contentType.id,
      tenantId,
      data: dataWithSlugs as any,
      locale: args.locale ?? "en",
      status: (args.status as "DRAFT" | "PUBLISHED") ?? "DRAFT",
    },
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
  args: { id: string; data: any }
) {
  const contentType = await db.contentType.findFirst({
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

  const existing = await db.contentEntry.findFirst({
    where: { id: args.id, contentTypeId: contentType.id, tenantId },
  })
  if (!existing) throw new Error("Entry not found")

  const fullData = { ...(existing.data as any), ...args.data }
  const dataWithSlugs = await processAutoSlugs(
    tenantId,
    contentType.id,
    contentType.fields,
    fullData,
    args.id
  )

  const updated = await db.contentEntry.update({
    where: { id: args.id },
    data: { data: dataWithSlugs as any, updatedAt: new Date() },
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

async function resolveMutationDelete(tenantId: string, slug: string, id: string) {
  const contentType = await db.contentType.findFirst({
    where: { 
      slug,
      OR: [
        { tenantId },
        { tenantId: null, tenants: { some: { tenantId, enabled: true } } }
      ]
    }
  })
  if (!contentType) throw new Error(`Content type '${slug}' not found`)

  const existing = await db.contentEntry.findFirst({
    where: { id, contentTypeId: contentType.id, tenantId },
  })
  if (!existing) throw new Error("Entry not found")

  await db.contentEntry.delete({ where: { id } })
  return { id, success: true }
}

async function resolveMutationPublish(tenantId: string, slug: string, id: string) {
  const contentType = await db.contentType.findFirst({
    where: { 
      slug,
      OR: [
        { tenantId },
        { tenantId: null, tenants: { some: { tenantId, enabled: true } } }
      ]
    }
  })
  if (!contentType) throw new Error(`Content type '${slug}' not found`)

  const existing = await db.contentEntry.findFirst({
    where: { id, contentTypeId: contentType.id, tenantId },
  })
  if (!existing) throw new Error("Entry not found")

  const updated = await db.contentEntry.update({
    where: { id },
    data: {
      status: "PUBLISHED",
      publishedAt: new Date(),
    },
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

async function resolveSingleType(tenantId: string, slug: string) {
  const singleType = await db.singleType.findFirst({
    where: { 
      slug,
      OR: [
        { tenantId },
        { tenantId: null, tenants: { some: { tenantId, enabled: true } } }
      ]
    }
  })
  if (!singleType) return null

  const assignment = await db.tenantSingleTypeAssignment.findUnique({
    where: {
      tenantId_singleTypeId: { tenantId, singleTypeId: singleType.id },
    },
  })
  if (!assignment || !assignment.data) return null

  return {
    ...(assignment.data as any),
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
