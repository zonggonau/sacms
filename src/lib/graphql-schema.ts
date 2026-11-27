import type { ContentEntry, Prisma, PrismaClient, SchemaField, SingleType } from "@/lib/database"
import { db } from "@/lib/database"
import { processAutoSlugs } from "@/lib/slug"
import { logAudit, AuditAction } from "@/lib/audit-log"
import { canTransition, canUserTransition, isWorkflowStatus } from "@/lib/content-workflow-rules"
import { resolveContentData } from "@/lib/content-resolver"
import { triggerWebhooks, executeSyncHooks, WebhookEvents } from "@/lib/webhooks"
import { snapshotVersion } from "@/lib/content/entry-service"
import { validateContentEntry } from "@/lib/content-validations"
import { validateDynamicContent } from "@/lib/validations/dynamic-validator"
import { parseSingleTypeData, readSingleTypeAssignment } from "@/lib/single-type-publication"

interface CollectionArgs {
  page?: number
  limit?: number
  sort?: string
  order?: string
  published?: boolean
  status?: string
}

const collectionSortFields = new Set([
  "id", "status", "createdAt", "updatedAt", "publishedAt", "scheduledAt", "archivedAt",
])

interface SchemaAccess {
  includeMutations: boolean
  staff?: { role: string; userId: string }
}

export async function buildTenantGraphQL(tenantId: string, access: SchemaAccess, client: PrismaClient = db) {
  const { includeMutations, staff } = access
  const [contentTypeAssignments, singleTypeAssignments] = await Promise.all([
    client.tenantContentTypeAssignment.findMany({
      where: { tenantId, enabled: true, contentType: { draftTemplateId: null } },
      orderBy: { contentType: { tenantId: { sort: "desc", nulls: "last" } } },
      include: { contentType: { include: { schemaFields: { orderBy: { order: "asc" } } } } },
    }),
    client.tenantSingleTypeAssignment.findMany({
      where: { tenantId, enabled: true, singleType: { draftTemplateId: null } },
      distinct: ["singleTypeId"],
      orderBy: { singleType: { tenantId: { sort: "desc", nulls: "last" } } },
      include: { singleType: { include: { schemaFields: { orderBy: { order: "asc" } } } } },
    }),
  ])

  const typeDefinitions: string[] = []
  const queryFields: string[] = []
  const mutationFields: string[] = []
  const registeredTypeNames = new Set<string>()
  // GraphQL.js calls rootValue methods with args first. The resolver already
  // closes over the tenant and authorization determined by the route handler.
  const rootValue: Record<string, unknown> = {}

  // Generate types for each content type
  for (const assignment of contentTypeAssignments) {
    const ct = assignment.contentType
    const typeName = toPascalCase(ct.slug)
    const queryName = sanitizeFieldName(ct.slug)
    if (registeredTypeNames.has(typeName)) continue
    registeredTypeNames.add(typeName)
    const fields = ct.schemaFields
      .filter((f) => !["id", "status", "publishedAt", "createdAt", "updatedAt"].includes(sanitizeFieldName(f.slug)))
      .map((f) => `  ${sanitizeFieldName(f.slug)}: ${mapFieldTypeToGraphQL(f.type, f.required)}`)
      .join("\n")

    typeDefinitions.push(`
type ${typeName} {
  id: ID!
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
      `  ${queryName}(page: Int, limit: Int, sort: String, order: String, published: Boolean, status: String): ${typeName}Collection`,
      `  ${queryName}ById(id: ID!): ${typeName}`
    )
    rootValue[queryName] = (args: CollectionArgs) =>
      resolveContentCollection(tenantId, ct, args, includeMutations, client)
    rootValue[`${queryName}ById`] = ({ id }: { id: string }) =>
      resolveContentEntryById(tenantId, ct, id, includeMutations, client)

    if (includeMutations) {
      mutationFields.push(
        `  create${typeName}(data: JSON!, status: String): ${typeName}`,
        `  update${typeName}(id: ID!, data: JSON!): ${typeName}`,
        `  delete${typeName}(id: ID!): DeleteResult!`,
        `  publish${typeName}(id: ID!): ${typeName}`
      )
      rootValue[`create${typeName}`] = (args: { data: unknown; status?: string }) =>
        resolveMutationCreate(tenantId, ct, args, client, staff?.userId, staff?.role)
      rootValue[`update${typeName}`] = (args: { id: string; data: unknown }) =>
        resolveMutationUpdate(tenantId, ct, args, client, staff?.userId)
      rootValue[`delete${typeName}`] = ({ id }: { id: string }) =>
        resolveMutationDelete(tenantId, ct, id, client, staff?.userId)
      rootValue[`publish${typeName}`] = ({ id }: { id: string }) =>
        resolveMutationPublish(tenantId, ct, id, client, staff?.userId, staff?.role)
    }
  }

  // Generate types for each single type
  for (const assignment of singleTypeAssignments) {
    const st = assignment.singleType
    const typeName = toPascalCase(st.slug) + "Single"
    const queryName = sanitizeFieldName(st.slug)
    if (registeredTypeNames.has(typeName) || Object.hasOwn(rootValue, queryName)) continue
    registeredTypeNames.add(typeName)
    const fields = st.schemaFields
      .filter((f) => !["publishedAt", "updatedAt"].includes(sanitizeFieldName(f.slug)))
      .map((f) => `  ${sanitizeFieldName(f.slug)}: ${mapFieldTypeToGraphQL(f.type, f.required)}`)
      .join("\n")

    typeDefinitions.push(`
type ${typeName} {
  publishedAt: String
  updatedAt: String
${fields}
}`)

    queryFields.push(`  ${queryName}(draft: Boolean): ${typeName}`)
    rootValue[queryName] = ({ draft }: { draft?: boolean }) =>
      resolveSingleType(tenantId, st, includeMutations && draft === true, client)
  }

  const typeDefs = `
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
  return { typeDefs, rootValue }
}

async function resolveContentCollection(
  tenantId: string,
  contentType: { id: string; schemaFields: SchemaField[] },
  args: CollectionArgs,
  includeUnpublished: boolean,
  client: PrismaClient,
) {
  const page = Math.max(args.page ?? 1, 1)
  const limit = Math.min(Math.max(args.limit ?? 25, 1), 100)
  const sort = args.sort ?? "createdAt"
  const order = args.order ?? "desc"
  if (!collectionSortFields.has(sort) || (order !== "asc" && order !== "desc")) {
    throw new Error("Invalid sort field or order")
  }
  const status = args.status ?? "PUBLISHED"
  if (!isWorkflowStatus(status)) throw new Error("Invalid content status")

  const where: Prisma.ContentEntryWhereInput = {
    contentTypeId: contentType.id,
    tenantId,
    deletedAt: null,
  }
  if (includeUnpublished) {
    if (args.status || args.published !== false) where.status = status
  } else {
    where.status = "PUBLISHED"
    if (args.status) where.AND = { status }
  }

  const [total, entries] = await Promise.all([
    client.contentEntry.count({ where }),
    client.contentEntry.findMany({
      where,
      orderBy: { [sort]: order },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ])

  const data = await Promise.all(entries.map(async (entry) => {
    const data = await resolveContentData(tenantId, parseSingleTypeData(entry.data), contentType.schemaFields, {
      client,
      includeUnpublished: includeUnpublished && entry.status !== "PUBLISHED",
      includeSingleTypeDraft: false,
    })
    return graphQLEntry(entry, data)
  }))

  return {
    data,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  }
}

async function resolveContentEntryById(
  tenantId: string,
  contentType: { id: string; schemaFields: SchemaField[] },
  id: string,
  includeUnpublished: boolean,
  client: PrismaClient,
) {
  const entry = await client.contentEntry.findFirst({
    where: {
      id, contentTypeId: contentType.id, tenantId, deletedAt: null,
      ...(!includeUnpublished && { status: "PUBLISHED" as const }),
    },
  })
  if (!entry) return null

  const data = await resolveContentData(tenantId, parseSingleTypeData(entry.data), contentType.schemaFields, {
    client,
    includeUnpublished: includeUnpublished && entry.status !== "PUBLISHED",
    includeSingleTypeDraft: false,
  })
  return graphQLEntry(entry, data)
}

export async function resolveMutationCreate(
  tenantId: string,
  model: ModelReference,
  args: { data: unknown; status?: string },
  _db: PrismaClient = db,
  userId?: string,
  staffRole?: string,
) {
  assertContentData(args.data)
  const status = args.status ?? "DRAFT"
  if (!isWorkflowStatus(status)) throw new Error("Invalid content status")
  if (status === "SCHEDULED") throw new Error("Scheduled publication requires a date and time")
  if (staffRole && status !== "DRAFT" && !canUserTransition("DRAFT", status, staffRole)) {
    throw new Error(`You do not have permission to create content with status '${status}'`)
  }

  const contentType = await requireWritableModel(tenantId, model, _db)
  const { slug } = contentType

  // B2 Fix: Execute sync hooks (beforeCreate) before writing
  const hookResult = await executeSyncHooks(tenantId, WebhookEvents.BEFORE_CREATE, args.data)
  if (!hookResult.allowed) {
    throw new Error(hookResult.rejectMessage || "Rejected by webhook")
  }
  const hookData = hookResult.modifiedData ?? args.data

  const dataWithSlugs = await processAutoSlugs(
    tenantId,
    contentType.id,
    contentType.schemaFields,
    hookData,
    undefined,
    'content',
    _db
  )
  const validatedData = await validateMutationData(_db, tenantId, contentType, dataWithSlugs, status !== "DRAFT")

  const entry = await _db.$transaction(async (tx) => {
    const newEntry = await tx.contentEntry.create({
      data: {
        contentTypeId: contentType.id,
        tenantId,
        data: validatedData as Prisma.InputJsonObject,
        status,
        publishedAt: status === "PUBLISHED" ? new Date() : null,
        createdBy: userId,
      },
    })

    // Set documentId to the same as id for the first version
    const updated = await tx.contentEntry.update({
      where: { id: newEntry.id },
      data: { documentId: newEntry.id }
    })

    await snapshotVersion(
      tx as PrismaClient,
      updated.id,
      updated.data,
      "created",
      userId ?? null,
      updated.publishedAt ?? null,
    )

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

  // B2 Fix: Trigger async webhooks after create
  triggerWebhooks(tenantId, WebhookEvents.CONTENT_CREATED, {
    entry: { id: entry.id, data: entry.data, status: entry.status },
    contentType: slug,
    source: "graphql",
  })

  return graphQLEntry(entry, parseSingleTypeData(entry.data))
}

export async function resolveMutationUpdate(
  tenantId: string,
  model: ModelReference,
  args: { id: string; data: unknown },
  _db: PrismaClient = db,
  userId?: string
) {
  assertContentData(args.data)
  const contentType = await requireWritableModel(tenantId, model, _db)
  const { slug } = contentType

  const existing = await _db.contentEntry.findFirst({
    where: { id: args.id, contentTypeId: contentType.id, tenantId, deletedAt: null },
  })
  if (!existing) throw new Error("Entry not found")

  // B2 Fix: Execute sync hooks (beforeUpdate) before writing
  const hookResult = await executeSyncHooks(tenantId, WebhookEvents.BEFORE_UPDATE, args.data)
  if (!hookResult.allowed) {
    throw new Error(hookResult.rejectMessage || "Rejected by webhook")
  }
  const hookData = hookResult.modifiedData ?? args.data

  const fullData = { ...parseSingleTypeData(existing.data), ...hookData }
  const dataWithSlugs = await processAutoSlugs(
    tenantId,
    contentType.id,
    contentType.schemaFields,
    fullData,
    args.id,
    'content',
    _db
  )
  const validatedData = await validateMutationData(_db, tenantId, contentType, dataWithSlugs, existing.status !== "DRAFT", args.id)

  const updated = await _db.$transaction(async (tx) => {
    const result = await tx.contentEntry.update({
      where: { id: args.id },
      data: {
        data: validatedData as Prisma.InputJsonObject,
        updatedBy: userId,
        updatedAt: new Date()
      },
    })

    await snapshotVersion(tx as PrismaClient, result.id, result.data, "updated", userId ?? null)

    return result
  })

  logAudit({
    tenantId,
    userId,
    action: AuditAction.CONTENT_UPDATED,
    entity: "ContentEntry",
    entityId: updated.id,
    data: { contentType: slug, source: "graphql" }
  })

  // B2 Fix: Trigger async webhooks after update
  triggerWebhooks(tenantId, WebhookEvents.CONTENT_UPDATED, {
    entry: { id: updated.id, data: updated.data, status: updated.status },
    contentType: slug,
    source: "graphql",
  })

  return graphQLEntry(updated, parseSingleTypeData(updated.data))
}

async function resolveMutationDelete(
  tenantId: string, 
  model: ModelReference,
  id: string, 
  _db: PrismaClient = db,
  userId?: string
) {
  const contentType = await requireWritableModel(tenantId, model, _db)
  const { slug } = contentType

  const existing = await _db.contentEntry.findFirst({
    where: { id, contentTypeId: contentType.id, tenantId, deletedAt: null },
  })
  if (!existing) throw new Error("Entry not found")

  // B2 Fix: Execute sync hooks (beforeDelete) before deleting
  const hookResult = await executeSyncHooks(tenantId, WebhookEvents.BEFORE_DELETE, {
    id,
    data: existing.data as Record<string, unknown>,
  })
  if (!hookResult.allowed) {
    throw new Error(hookResult.rejectMessage || "Rejected by webhook")
  }

  // Soft-delete into trash — same semantics as the REST/dashboard delete
  // path (entry-service.ts's deleteContentEntry), so a GraphQL client can't
  // bypass the restore window the dashboard relies on.
  await _db.contentEntry.update({ where: { id }, data: { deletedAt: new Date() } })

  logAudit({
    tenantId,
    userId,
    action: AuditAction.CONTENT_DELETED,
    entity: "ContentEntry",
    entityId: id,
    data: { contentType: slug, source: "graphql" }
  })

  // B2 Fix: Trigger async webhooks after delete
  triggerWebhooks(tenantId, WebhookEvents.CONTENT_DELETED, {
    entry: { id, data: existing.data },
    contentType: slug,
    source: "graphql",
  })

  return { id, success: true }
}

async function resolveMutationPublish(
  tenantId: string, 
  model: ModelReference,
  id: string, 
  _db: PrismaClient = db,
  userId?: string,
  staffRole?: string,
) {
  const contentType = await requireWritableModel(tenantId, model, _db)
  const { slug } = contentType

  const existing = await _db.contentEntry.findFirst({
    where: { id, contentTypeId: contentType.id, tenantId, deletedAt: null },
  })
  if (!existing) throw new Error("Entry not found")

  // B1 Fix: Enforce content workflow — check if transition to PUBLISHED is valid
  if (!canTransition(existing.status, "PUBLISHED")) {
    throw new Error(
      `Cannot publish entry: transition from '${existing.status}' to 'PUBLISHED' is not allowed. ` +
      `Current status must be DRAFT or APPROVED.`
    )
  }
  if (staffRole && !canUserTransition(existing.status, "PUBLISHED", staffRole)) {
    throw new Error("You do not have permission to publish this entry")
  }
  await validateMutationData(_db, tenantId, contentType, parseSingleTypeData(existing.data), true, id)

  // B2 Fix: Execute sync hooks (beforePublish) before publishing
  const hookResult = await executeSyncHooks(tenantId, WebhookEvents.BEFORE_PUBLISH, {
    id,
    data: existing.data as Record<string, unknown>,
    currentStatus: existing.status,
  })
  if (!hookResult.allowed) {
    throw new Error(hookResult.rejectMessage || "Rejected by webhook")
  }

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

  // B2 Fix: Trigger async webhooks after publish
  triggerWebhooks(tenantId, WebhookEvents.CONTENT_PUBLISHED, {
    entry: { id: updated.id, data: updated.data, status: updated.status },
    contentType: slug,
    source: "graphql",
  })

  return graphQLEntry(updated, parseSingleTypeData(updated.data))
}

async function resolveSingleType(
  tenantId: string,
  singleType: Pick<SingleType, "id"> & { schemaFields: SchemaField[] },
  includeDraft: boolean,
  client: PrismaClient,
) {
  const assignment = await client.tenantSingleTypeAssignment.findFirst({
    where: {
      tenantId, singleTypeId: singleType.id, enabled: true,
      ...(!includeDraft && { publishedAt: { not: null } }),
    },
  })
  if (!assignment) return null

  const snapshot = readSingleTypeAssignment(assignment, includeDraft)
  const data = await resolveContentData(tenantId, snapshot.data, singleType.schemaFields, {
    client, includeUnpublished: includeDraft, includeSingleTypeDraft: includeDraft,
  })

  return {
    ...graphQLData(data),
    publishedAt: assignment.publishedAt?.toISOString() ?? null,
    updatedAt: snapshot.updatedAt.toISOString(),
  }
}

// Helpers

type ModelReference = string | { id: string; slug: string }

async function requireWritableModel(tenantId: string, model: ModelReference, client: PrismaClient) {
  const slug = typeof model === "string" ? model : model.slug
  const contentType = await client.contentType.findFirst({
    where: {
      slug, draftTemplateId: null,
      ...(typeof model !== "string" && { id: model.id }),
      OR: [{ tenantId }, { tenantId: null }],
      tenants: { some: { tenantId, enabled: true } },
    },
    orderBy: { tenantId: { sort: "desc", nulls: "last" } },
    include: { schemaFields: true },
  })
  if (!contentType) throw new Error(`Content type '${slug}' not found`)
  return contentType
}

async function validateMutationData(
  client: PrismaClient,
  tenantId: string,
  contentType: { id: string; schemaFields: SchemaField[] },
  data: Record<string, unknown>,
  enforceRequired: boolean,
  entryId?: string,
) {
  if (contentType.schemaFields.length === 0) return data

  const validation = await validateContentEntry(contentType.schemaFields, data, { enforceRequired })
  if (!validation.success) throw new Error(Object.values(validation.errors ?? {}).join(". ") || "Invalid content data")

  const normalized = { ...data, ...validation.data }
  const dynamic = await validateDynamicContent(contentType.id, tenantId, normalized, entryId, { client, enforceRequired })
  if (!dynamic.success) throw new Error(Object.values(dynamic.errors ?? {}).join(". ") || "Invalid content data")
  return normalized
}

function graphQLEntry(entry: ContentEntry, data: Record<string, unknown>) {
  return {
    ...graphQLData(data),
    id: entry.id,
    status: entry.status,
    publishedAt: entry.publishedAt?.toISOString() ?? null,
    createdAt: entry.createdAt.toISOString(),
    updatedAt: entry.updatedAt.toISOString(),
  }
}

function graphQLData(data: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(data).map(([slug, value]) => [sanitizeFieldName(slug), value]))
}

function assertContentData(data: unknown): asserts data is Record<string, unknown> {
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("Content data must be an object")
}

function toPascalCase(slug: string): string {
  return slug
    .split(/[-_]/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join("")
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
