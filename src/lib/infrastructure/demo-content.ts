import { createHash } from "node:crypto"
import sharp from "sharp"
import type { Prisma } from "@prisma/client"
import { db } from "@/lib/database"
import { resolveWriteLocale, createContentEntry, updateContentEntry } from "@/lib/content/entry-service"
import { validateContentEntry } from "@/lib/content-validations"
import { DemoContentError, findSchemaDemoWorkspace, seedSampleContent } from "./demo-tenant"
import { invalidateSingleTypePublication, parseSingleTypeData, readSingleTypeAssignment, singleTypeContentWrite } from "@/lib/single-type-publication"
import { rewritePublicMediaUrls } from "@/lib/public-media-url"
import { deleteFromStorage, uploadTenantMedia } from "@/lib/r2"
import { validateMagicBytes } from "@/lib/validations/media"
import { sanitizeHtml } from "@/lib/sanitize-html"
import { invalidatePattern } from "@/lib/cache"
import type { SchemaBlob } from "@/lib/schema-template-sync"

export { DemoContentError } from "./demo-tenant"

type DemoClient = typeof db | Prisma.TransactionClient
type DemoWorkspace = { id: string; slug: string }
type DemoField = { slug: string; name: string; type: string; required: boolean; options?: unknown; relationSlug?: string | null }
type Values = Record<string, unknown>
type SingleTypeInput = { singleTypeSlug: string; locale?: string }
type CollectionInput = { contentTypeSlug: string; locale?: string }

export const DEMO_MEDIA_MAX_BYTES = 2 * 1024 * 1024
export const DEMO_MEDIA_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"] as const
type DemoMimeType = typeof DEMO_MEDIA_TYPES[number]
const mediaExtensions: Record<DemoMimeType, string> = {
  "image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp", "image/gif": ".gif",
}
const reservedKeys = new Set(["__proto__", "prototype", "constructor"])

function invalid(message: string, details?: unknown): never {
  throw new DemoContentError("VALIDATION_FAILED", message, details)
}

export async function requireDemoWorkspace(templateId: string, client: DemoClient = db) {
  const template = await client.schemaTemplate.findFirst({
    where: { OR: [{ id: templateId }, { slug: templateId }] },
    select: { id: true, demoTenantId: true },
  })
  if (!template) throw new DemoContentError("NOT_FOUND", "Schema Template not found.")
  const demo = await findSchemaDemoWorkspace(client, template)
  if (!demo) throw new DemoContentError("DEMO_NOT_AVAILABLE", "This Schema Template has no eligible demo workspace.")
  return demo
}

async function localeFor(client: DemoClient, demo: DemoWorkspace, locale?: string) {
  const result = await resolveWriteLocale(client, demo.id, locale)
  if (!result.ok) invalid(result.message)
  return result.data
}

async function loadSingleType(client: DemoClient, demo: DemoWorkspace, input: SingleTypeInput) {
  const singleType = await client.singleType.findFirst({
    where: { tenantId: demo.id, slug: input.singleTypeSlug, draftTemplateId: null },
    include: { schemaFields: { orderBy: { order: "asc" } } },
  })
  if (!singleType) throw new DemoContentError("NOT_FOUND", "Single Type not found in this demo workspace.")
  const locale = await localeFor(client, demo, input.locale)
  const assignment = await client.tenantSingleTypeAssignment.findUnique({
    where: { tenantId_singleTypeId_locale: { tenantId: demo.id, singleTypeId: singleType.id, locale } },
  })
  return { singleType, locale, assignment }
}

function singleTypeResult(demo: DemoWorkspace, { singleType, locale, assignment }: Awaited<ReturnType<typeof loadSingleType>>) {
  const publicEntry = Boolean(singleType.isPublished && assignment?.enabled && assignment.publishedAt)
  const hasDraft = assignment?.draftData != null
  const data = assignment ? readSingleTypeAssignment(assignment, true).data : {}
  const status = assignment?.enabled === false || !singleType.isPublished ? "disabled"
    : publicEntry ? "published"
      : hasDraft || Object.keys(data).length ? "draft" : "empty"
  return {
    demo,
    singleType: { id: singleType.id, slug: singleType.slug, name: singleType.name },
    locale,
    status,
    hasPendingDraft: hasDraft,
    version: assignment?.updatedAt.toISOString() ?? null,
    publishedAt: assignment?.publishedAt?.toISOString() ?? null,
    data,
    publishedData: publicEntry ? rewritePublicMediaUrls(parseSingleTypeData(assignment?.data)) : null,
  }
}

export async function getDemoSingleTypeEntry(templateId: string, input: SingleTypeInput) {
  const demo = await requireDemoWorkspace(templateId)
  return singleTypeResult(demo, await loadSingleType(db, demo, input))
}

function isObject(value: unknown): value is Values {
  return Boolean(value && typeof value === "object" && !Array.isArray(value))
}

function assertSafeData(value: unknown, depth = 0) {
  if (depth > 12) invalid("Demo data exceeds the supported nesting depth.")
  if (isObject(value)) {
    for (const [key, child] of Object.entries(value)) {
      if (reservedKeys.has(key)) invalid("Demo data contains a reserved object key.")
      assertSafeData(child, depth + 1)
    }
  } else if (Array.isArray(value)) {
    if (value.length > 100) invalid("Demo fields support at most 100 items per array.")
    for (const child of value) assertSafeData(child, depth + 1)
  }
}

function fieldOptions(value: unknown): Values {
  if (typeof value === "string") {
    try { value = JSON.parse(value) } catch { return {} }
  }
  return isObject(value) ? value : {}
}

function navigationUrl(value: unknown, path: string) {
  if (typeof value !== "string") invalid(`${path} must be a URL string.`)
  let url: URL
  try { url = new URL(value, "https://demo.invalid") } catch { invalid(`${path} must be a valid URL.`) }
  if (!["http:", "https:", "mailto:", "tel:"].includes(url.protocol)) invalid(`${path} uses an unsupported URL protocol.`)
  return value
}

async function mergeDemoData(
  client: DemoClient,
  demo: DemoWorkspace,
  fields: DemoField[],
  current: Values,
  patch: Values,
  enforceRequired: boolean,
) {
  if (JSON.stringify(patch).length > 256_000) invalid("Demo entry data exceeds 256 KB.")
  assertSafeData(patch)
  // The existing payload may contain fields from an older schema. Keep
  // those keys intact while requiring every new key to match the schema.
  const components = new Map<string, Promise<{ schemaFields: DemoField[] } | null>>()
  const media = new Map<string, Promise<{ url: string } | null>>()

  async function mediaValue(value: unknown, path: string) {
    if (typeof value !== "string") invalid(`${path} must be a demo media ID or its stored URL.`)
    let record = media.get(value)
    if (!record) {
      record = client.media.findFirst({
        where: { tenantId: demo.id, isPrivate: false, OR: [{ id: value }, { url: value }] },
        select: { url: true },
      })
      media.set(value, record)
    }
    const asset = await record
    if (!asset) invalid(`${path} must reference public media uploaded to this demo workspace.`)
    return asset.url
  }

  async function componentValue(slug: unknown, data: unknown, path: string) {
    if (typeof slug !== "string" || !isObject(data)) invalid(`${path} must contain an object for a valid demo Component.`)
    let record = components.get(slug)
    if (!record) {
      record = client.component.findFirst({
        where: { tenantId: demo.id, slug, draftTemplateId: null },
        select: { schemaFields: true },
      })
      components.set(slug, record)
    }
    const model = await record
    if (!model) invalid(`${path} references a Component that does not exist in this demo workspace.`)
    const dataToValidate = await normalizeFields(model.schemaFields, data, path)
    const validation = await validateContentEntry(model.schemaFields, dataToValidate, { enforceRequired })
    if (!validation.success) invalid(`${path} has invalid Component fields.`, validation.errors)
    return { ...dataToValidate, ...validation.data }
  }

  async function normalizeFields(modelFields: DemoField[], values: Values, path: string): Promise<Values> {
    const bySlug = new Map(modelFields.map((field) => [field.slug, field]))
    const normalized: Values = {}
    for (const [slug, value] of Object.entries(values)) {
      const field = bySlug.get(slug)
      const fieldPath = path ? `${path}.${slug}` : slug
      if (!field) invalid(`Unknown field '${fieldPath}'.`)
      const options = fieldOptions(field.options)
      if (value === null || value === "") {
        normalized[slug] = value
        continue
      }
      switch (field.type) {
        case "component":
          if (options.repeatable === true) {
            if (!Array.isArray(value)) invalid(`${fieldPath} must be an array of Components.`)
            normalized[slug] = await Promise.all(value.map((item, i) => componentValue(options.componentSlug, item, `${fieldPath}[${i}]`)))
          } else {
            normalized[slug] = await componentValue(options.componentSlug, value, fieldPath)
          }
          break
        case "repeater": {
          if (!Array.isArray(value)) invalid(`${fieldPath} must be an array of blocks with __component.`)
          const allowed = Array.isArray(options.allowedComponents) ? options.allowedComponents : []
          normalized[slug] = await Promise.all(value.map(async (block, i) => {
            const blockPath = `${fieldPath}[${i}]`
            if (!isObject(block) || typeof block.__component !== "string") invalid(`${blockPath} requires a __component slug.`)
            const { __component, ...content } = block
            if (allowed.length && !allowed.includes(__component)) invalid(`${blockPath} uses a Component that is not allowed.`)
            return { ...(await componentValue(__component, content, blockPath)), __component }
          }))
          break
        }
        case "media":
        case "file":
          normalized[slug] = await mediaValue(value, fieldPath)
          break
        case "mediaMultiple":
        case "media_multiple":
          if (!Array.isArray(value)) invalid(`${fieldPath} must be an array of demo media.`)
          normalized[slug] = await Promise.all(value.map((item, i) => mediaValue(item, `${fieldPath}[${i}]`)))
          break
        case "seo":
          if (!isObject(value)) invalid(`${fieldPath} must be an SEO object.`)
          normalized[slug] = value.og_image ? { ...value, og_image: await mediaValue(value.og_image, `${fieldPath}.og_image`) } : value
          break
        case "relation": {
          const target = field.relationSlug || options.targetSlug
          const references = Array.isArray(value) ? value : [value]
          for (const id of references) {
            if (typeof id !== "string") invalid(`${fieldPath} requires a demo record ID.`)
            const record = target === "member" || options.targetModel === "member"
              ? await client.member.findFirst({ where: { id, tenantId: demo.id }, select: { id: true } })
              : options.targetModel === "single-type"
                ? await client.singleType.findFirst({ where: { id, tenantId: demo.id, slug: String(target), draftTemplateId: null }, select: { id: true } })
                : await client.contentEntry.findFirst({
                  where: { id, tenantId: demo.id, deletedAt: null, contentType: { tenantId: demo.id, slug: String(target), draftTemplateId: null } },
                  select: { id: true },
                })
            if (!record) invalid(`${fieldPath} must reference a record in the related demo model.`)
          }
          normalized[slug] = value
          break
        }
        case "richText":
        case "richtext":
          if (typeof value !== "string") invalid(`${fieldPath} must be HTML text.`)
          normalized[slug] = sanitizeHtml(value)
          break
        case "url":
          normalized[slug] = navigationUrl(value, fieldPath)
          break
        case "button":
          if (!isObject(value)) invalid(`${fieldPath} must be a Button object.`)
          normalized[slug] = value.url ? { ...value, url: navigationUrl(value.url, `${fieldPath}.url`) } : value
          break
        case "boolean":
          if (typeof value !== "boolean") invalid(`${fieldPath} must be a boolean.`)
          normalized[slug] = value
          break
        default:
          normalized[slug] = value
      }
    }
    return normalized
  }

  const changed = await normalizeFields(fields, patch, "")
  const merged = { ...current, ...changed }
  const validation = await validateContentEntry(fields, merged, { enforceRequired })
  if (!validation.success) invalid("Invalid demo entry fields.", validation.errors)
  const normalizedChanges = Object.fromEntries(Object.entries(changed).map(([key, value]) => [
    key,
    validation.data?.[key] === undefined ? value : validation.data[key],
  ]))
  return { ...current, ...normalizedChanges }
}

export async function updateDemoSingleTypeEntry(
  templateId: string,
  input: SingleTypeInput & { data: Values; publish: boolean; expectedVersion?: string | null },
) {
  const result = await db.$transaction(async (tx) => {
    const demo = await requireDemoWorkspace(templateId, tx)
    const current = await loadSingleType(tx, demo, input)
    const { singleType, locale, assignment } = current
    if (input.expectedVersion !== undefined && input.expectedVersion !== (assignment?.updatedAt.toISOString() ?? null)) {
      throw new DemoContentError("CONFLICT", "Demo entry has changed. Read it again before saving.")
    }
    const data = await mergeDemoData(tx, demo, singleType.schemaFields, singleTypeResult(demo, current).data, input.data, input.publish)
    const content = singleTypeContentWrite(data, input.publish)
    const saved = assignment
      ? await tx.tenantSingleTypeAssignment.update({ where: { id: assignment.id, tenantId: demo.id, updatedAt: assignment.updatedAt }, data: content })
      : await tx.tenantSingleTypeAssignment.create({ data: { tenantId: demo.id, singleTypeId: singleType.id, locale, ...content } })
    return singleTypeResult(demo, { ...current, assignment: saved })
  })
  if (input.publish) await invalidateSingleTypePublication(result.demo.id, result.singleType.slug, result.locale)
  return result
}

async function loadDemoCollection(demo: DemoWorkspace, input: CollectionInput) {
  const model = await db.contentType.findFirst({
    where: { tenantId: demo.id, slug: input.contentTypeSlug, draftTemplateId: null },
    include: { schemaFields: true },
  })
  if (!model) throw new DemoContentError("NOT_FOUND", "Content Type not found in this demo workspace.")
  return { model, locale: await localeFor(db, demo, input.locale) }
}

function collectionEntryResult(entry: { id: string; locale: string; status: string; data: unknown; updatedAt: Date; publishedAt: Date | null }) {
  return { id: entry.id, locale: entry.locale, status: entry.status, data: parseSingleTypeData(entry.data), version: entry.updatedAt.toISOString(), publishedAt: entry.publishedAt?.toISOString() ?? null }
}

export async function listDemoContentEntries(templateId: string, input: CollectionInput & { limit: number; offset: number }) {
  const demo = await requireDemoWorkspace(templateId)
  const { model, locale } = await loadDemoCollection(demo, input)
  const rows = await db.contentEntry.findMany({
    where: { tenantId: demo.id, contentTypeId: model.id, locale, deletedAt: null },
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    skip: input.offset,
    take: input.limit + 1,
  })
  return { demo, contentTypeSlug: model.slug, locale, entries: rows.slice(0, input.limit).map(collectionEntryResult), hasMore: rows.length > input.limit }
}

export async function saveDemoContentEntry(
  templateId: string,
  input: CollectionInput & { data: Values; entryId?: string; status?: "DRAFT" | "PUBLISHED"; expectedVersion?: string },
) {
  const demo = await requireDemoWorkspace(templateId)
  const { model, locale } = await loadDemoCollection(demo, input)
  const current = input.entryId ? await db.contentEntry.findFirst({
    where: { id: input.entryId, tenantId: demo.id, contentTypeId: model.id, locale, deletedAt: null },
  }) : null
  if (input.entryId && !current) throw new DemoContentError("NOT_FOUND", "Entry not found in the requested demo locale.")
  if (input.expectedVersion && input.expectedVersion !== current?.updatedAt.toISOString()) {
    throw new DemoContentError("CONFLICT", "Demo entry has changed. Read it again before saving.")
  }
  const status = input.status ?? current?.status ?? "DRAFT"
  const data = await mergeDemoData(db, demo, model.schemaFields, parseSingleTypeData(current?.data), input.data, status !== "DRAFT")
  const context = { tenantId: demo.id, tenantSlug: demo.slug, client: db }
  const values = {
    contentTypeSlug: model.slug, locale, data, status,
    ...(status === "SCHEDULED" ? { scheduledAt: current?.scheduledAt } : {}),
  }
  const result = current
    ? await updateContentEntry(context, { kind: "system" }, { ...values, entryId: current.id, expectedUpdatedAt: current.updatedAt })
    : await createContentEntry(context, { kind: "system" }, values)
  if (!result.ok) throw new DemoContentError(result.code.toUpperCase(), result.message, result.details)
  return { demo, contentTypeSlug: model.slug, entry: collectionEntryResult(result.data) }
}

export async function uploadDemoMedia(
  templateId: string,
  input: { filename: string; mimeType: DemoMimeType; base64: string; alt?: string },
) {
  const demo = await requireDemoWorkspace(templateId)
  const raw = input.base64
  if (raw.length > Math.ceil(DEMO_MEDIA_MAX_BYTES / 3) * 4 || !/^[A-Za-z0-9+/]+={0,2}$/.test(raw)) invalid("Provide canonical base64 image data up to 2 MB.")
  const buffer = Buffer.from(raw, "base64")
  if (buffer.length > DEMO_MEDIA_MAX_BYTES || buffer.toString("base64") !== raw || !validateMagicBytes(buffer, input.mimeType)) {
    invalid("Image signature or base64 data is invalid.")
  }
  const metadata = await sharp(buffer, { limitInputPixels: 16_000_000 }).metadata().catch(() => null)
  if (!metadata?.width || !metadata?.height || metadata.width * metadata.height > 16_000_000) invalid("Invalid image or image resolution exceeds 16 megapixels.")
  const filename = input.filename.trim()
  const hasControl = [...filename].some((character) => {
    const code = character.charCodeAt(0)
    return code < 32 || code === 127
  })
  if (!filename || /[/\\:]/.test(filename) || hasControl) invalid("Provide a file name without directories or control characters.")
  const name = filename.replace(/\.[^.]+$/, "").trim()
  if (!name || name === "." || name === "..") invalid("Invalid image file name.")

  const sha256 = createHash("sha256").update(buffer).digest("hex")
  const prior = await db.media.findFirst({
    where: { tenantId: demo.id, mimeType: input.mimeType, isPrivate: false, name, alt: input.alt ?? null, metadata: { path: ["demoUploadSha256"], equals: sha256 } },
    select: { id: true, url: true, mimeType: true, size: true },
  })
  if (prior) return { demo, media: prior, reused: true }

  const { checkStorageUpload } = await import("@/lib/plan-enforcement")
  const quota = await checkStorageUpload(demo.id, buffer.length)
  if (!quota.allowed) throw new DemoContentError("PLAN_LIMIT", quota.message || "The demo storage limit has been reached.")
  const upload = await uploadTenantMedia(demo, buffer, name + mediaExtensions[input.mimeType], input.mimeType)
  try {
    const asset = await db.media.create({
      data: {
        tenantId: demo.id, name, originalName: name + mediaExtensions[input.mimeType],
        mimeType: input.mimeType, size: buffer.length, alt: input.alt,
        metadata: { demoUploadSha256: sha256 }, ...upload,
      },
      select: { id: true, url: true, mimeType: true, size: true },
    })
    return { demo, media: asset, reused: false }
  } catch (error) {
    const asset = await db.media.findFirst({
      where: { tenantId: demo.id, storageKey: upload.storageKey },
      select: { id: true, url: true, mimeType: true, size: true },
    })
    if (asset) return { demo, media: asset, reused: false }
    await deleteFromStorage(upload.storageKey, demo.id).catch((cleanupError) => console.error("[demo media cleanup]", cleanupError))
    throw error
  }
}

export async function resetDemoContent(templateId: string) {
  const reset = await db.$transaction(async (tx) => {
    const demo = await requireDemoWorkspace(templateId, tx)
    const template = await tx.schemaTemplate.findFirst({ where: { demoTenantId: demo.id }, select: { schema: true } })
    if (!template) throw new DemoContentError("DEMO_NOT_AVAILABLE", "The linked demo schema is unavailable.")
    const [entries, assignments] = await Promise.all([
      tx.contentEntry.deleteMany({ where: { tenantId: demo.id, contentType: { tenantId: demo.id, draftTemplateId: null } } }),
      tx.tenantSingleTypeAssignment.deleteMany({ where: { tenantId: demo.id, singleType: { tenantId: demo.id, draftTemplateId: null } } }),
    ])
    return { demo, schema: template.schema as SchemaBlob, deletedEntries: entries.count, deletedAssignments: assignments.count }
  })
  const { demo, schema, ...counts } = reset
  let warnings: Array<{ model: string; message: string }>
  try {
    warnings = await seedSampleContent(db, demo.id, demo.slug, schema, true)
  } catch (error) {
    console.error("[demo reset reseed]", error)
    warnings = [{ model: "demo", message: "The reset removed prior content, but reseeding did not finish. Inspect the demo before retrying." }]
  }
  await Promise.allSettled([
    invalidatePattern(`public_api*:${demo.slug}:*`),
    invalidatePattern(`single:${demo.id}:*`),
    invalidatePattern(`graphql:${demo.id}:*`),
  ])
  return { demo, ...counts, status: warnings.length ? "partial" : "completed", warnings }
}
