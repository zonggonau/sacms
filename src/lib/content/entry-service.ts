/**
 * ContentEntryService — the single write path for ContentEntry.
 *
 * Before this module the create / update / delete / status-transition logic for a
 * content entry (schema + dynamic validation, auto-slug, sync hooks, versioning,
 * translation flow, shared-field sync, webhooks, cache invalidation) was
 * reimplemented in five places with drift — most visibly three different
 * `documentId` generators. Every surface now goes through here:
 *
 *   - src/actions/content.ts          (CMS dashboard, staff actor)
 *   - src/actions/admin-content.ts    (super-admin global content, system actor) [pending]
 *   - api/tenant/[tenant]/content     (tenant REST) [pending]
 *   - api/public/[tenant]/content     (headless REST, member/public/token actor)
 *   - api/mcp/[[...transport]]        (MCP tools, system actor) [pending]
 *
 * A caller resolves auth + the tenant Prisma client, then hands the service a
 * `ContentActor` and an input object. The service returns a discriminated result
 * (`{ ok: true, entry }` | `{ ok: false, code, message, details? }`) — it never
 * throws for expected failures and never talks to `NextResponse` / `revalidatePath`.
 */

import { randomUUID } from "crypto"
import type { PrismaClient, ContentEntry } from "@/lib/database"
import { db } from "@/lib/database"
import { validateContentEntry } from "@/lib/content-validations"
import { validateDynamicContent } from "@/lib/validations/dynamic-validator"
import { processAutoSlugs } from "@/lib/slug"
import { parseSchemaFieldOptions, validateScheduledPublicationDate } from "@/actions/content-pipeline"
import { canUserTransition } from "@/lib/content-workflow"
import { isWorkflowStatus, type WorkflowStatus } from "@/lib/content-workflow-rules"
import { executeSyncHooks, triggerWebhooks, WebhookEvents } from "@/lib/webhooks"
import { logAudit, AuditAction } from "@/lib/audit-log"
import { invalidatePattern } from "@/lib/cache"

// ── Actor ────────────────────────────────────────────────────────────────

/**
 * Who is performing the write. Drives ownership checks, workflow-transition
 * permission, plan enforcement, and the `createdBy` / `updatedBy` stamp.
 *
 *  - `staff`  — a CMS operator (TenantMember). `role` gates workflow transitions
 *               and ownership; `userId` is stamped and audited.
 *  - `member` — a headless end-user. Treated as lowest-privilege: may only ever
 *               create/update as DRAFT, and (when `ownershipRequired`) only touch
 *               their own entries. `memberId` is stamped.
 *  - `public` — an anonymous headless caller. DRAFT only, never an owner.
 *  - `system` — a trusted server context (super-admin global content, MCP, cron).
 *               Bypasses workflow-permission and plan checks.
 */
export type ContentActor =
  | { kind: "staff"; userId: string; role: string; customPermissions?: string[] | null }
  | { kind: "member"; memberId: string; ownershipRequired?: boolean }
  | { kind: "public" }
  | { kind: "system"; userId?: string }

function actorUserId(actor: ContentActor): string | null {
  if (actor.kind === "staff") return actor.userId
  if (actor.kind === "member") return actor.memberId
  if (actor.kind === "system") return actor.userId ?? null
  return null
}

/** Headless actors (member/public) can only ever write DRAFT content. */
function actorMayOnlyDraft(actor: ContentActor): boolean {
  return actor.kind === "member" || actor.kind === "public"
}

// ── Result ───────────────────────────────────────────────────────────────

export type ServiceError =
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "validation"
  | "conflict"
  | "rejected_by_hook"
  | "invalid_status"
  | "locale_not_enabled"
  | "plan_limit"

export type ServiceResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: ServiceError; message: string; details?: Record<string, string> }

const fail = (code: ServiceError, message: string, details?: Record<string, string>): ServiceResult<never> => ({
  ok: false,
  code,
  message,
  details,
})
const done = <T>(data: T): ServiceResult<T> => ({ ok: true, data })

// ── Shared primitives ────────────────────────────────────────────────────

/** The one canonical document id. Was 3 different generators across the codebase. */
export function generateDocumentId(): string {
  return randomUUID()
}

/** Normalise a scheduledAt that may arrive as a Date, an ISO string, or nullish. */
export function normalizeScheduledAt(value: Date | string | null | undefined): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value
  if (typeof value === "string" && value.trim()) {
    const d = new Date(value)
    return Number.isNaN(d.getTime()) ? null : d
  }
  return null
}

interface ContentTypeContext {
  /** Resolved tenant id, or `null` for super-admin global content. */
  tenantId: string | null
  /** True for the platform's global workspace (may read/write tenantId:null types). */
  isGlobal?: boolean
}

type ResolvedContentType = Awaited<ReturnType<typeof loadContentType>>

async function loadContentType(client: PrismaClient, slug: string, ctx: ContentTypeContext) {
  if (ctx.tenantId === null) {
    return client.contentType.findFirst({
      where: { slug, tenantId: null },
      include: { schemaFields: { orderBy: { order: "asc" } }, tenants: true },
    })
  }
  return client.contentType.findFirst({
    where: {
      slug,
      OR: [
        { tenantId: ctx.tenantId },
        { tenantId: null, tenants: { some: { tenantId: ctx.tenantId, enabled: true } } },
        ...(ctx.isGlobal ? [{ tenantId: null }] : []),
      ],
    },
    include: { schemaFields: { orderBy: { order: "asc" } }, tenants: true },
  })
}

/**
 * Resolve the content type a write targets, honouring tenant assignment.
 * Returns the row plus its parsed field definitions.
 */
export async function resolveWritableContentType(
  client: PrismaClient,
  slug: string,
  ctx: ContentTypeContext,
): Promise<ServiceResult<{ contentType: NonNullable<ResolvedContentType>; fields: any[] }>> {
  const contentType = await loadContentType(client, slug, ctx)
  if (!contentType) return fail("not_found", "Content type not found")

  if (ctx.tenantId !== null) {
    const isGlobalType = contentType.tenants.length === 0
    const isAssigned = contentType.tenants.some((t) => t.tenantId === ctx.tenantId && t.enabled)
    if (!isGlobalType && !isAssigned) {
      return fail("forbidden", "Content type is not available for this workspace")
    }
  }

  return done({ contentType, fields: parseSchemaFieldOptions(contentType.schemaFields) })
}

/** Resolve the locale a write lands in and verify it is enabled for the tenant. */
export async function resolveWriteLocale(
  client: PrismaClient,
  tenantId: string | null,
  requested: string | null | undefined,
): Promise<ServiceResult<string>> {
  if (tenantId === null) return done((requested && requested.trim()) || "en")

  const enabled = await client.tenantLocale.findMany({
    where: { tenantId, isEnabled: true },
    select: { locale: true, isDefault: true },
  })

  if (requested && requested.trim()) {
    const locale = requested.trim()
    if (enabled.length > 0 && !enabled.some((l) => l.locale === locale)) {
      return fail("locale_not_enabled", `Locale '${locale}' is not enabled for this workspace`)
    }
    return done(locale)
  }
  return done(enabled.find((l) => l.isDefault)?.locale ?? enabled[0]?.locale ?? "en")
}

/** publishedAt / scheduledAt / archivedAt for a target status given a previous one. */
function timestampsFor(status: WorkflowStatus, prevStatus: WorkflowStatus | null, scheduledAt: Date | null) {
  const out: { publishedAt?: Date | null; scheduledAt?: Date | null; archivedAt?: Date | null } = {}
  if (status === "PUBLISHED") {
    if (prevStatus !== "PUBLISHED") out.publishedAt = new Date()
    out.scheduledAt = null
  } else if (status === "SCHEDULED") {
    out.scheduledAt = scheduledAt
  } else {
    // DRAFT / IN_REVIEW / APPROVED / REJECTED / ARCHIVED
    if (prevStatus === "PUBLISHED") out.publishedAt = null
    out.scheduledAt = null
  }
  if (status === "ARCHIVED") out.archivedAt = new Date()
  else if (prevStatus === "ARCHIVED") out.archivedAt = null
  return out
}

async function snapshotVersion(
  tx: PrismaClient,
  contentEntryId: string,
  data: unknown,
  changeType: "created" | "updated",
  changedBy: string | null,
  publishedAt: Date | null = null,
) {
  const last = await tx.contentVersion.findFirst({
    where: { contentEntryId },
    orderBy: { version: "desc" },
    select: { version: true },
  })
  await tx.contentVersion.create({
    data: {
      contentEntryId,
      version: (last?.version ?? 0) + 1,
      data: data as any,
      changeType,
      changedBy,
      publishedAt,
    },
  })
}

/** Bust the public REST cache + let the caller know which paths to revalidate. */
export async function invalidateContentCaches(tenantSlug: string, contentTypeSlug: string): Promise<void> {
  await invalidatePattern(`public_api*:${tenantSlug}:${contentTypeSlug}:*`).catch(() => {})
}

/** Dashboard paths a mutation should revalidate. Callers pass these to `revalidatePath`. */
export function contentRevalidatePaths(tenantSlug: string, contentTypeSlug: string): string[] {
  return [
    `/dashboard/${tenantSlug}/content-types/${contentTypeSlug}`,
    `/dashboard/${tenantSlug}/single-types/${contentTypeSlug}`,
  ]
}

// ── Common context for a service call ────────────────────────────────────

export interface EntryWriteContext {
  /** Tenant Prisma client (shared pool or dedicated). For global content pass `db`. */
  client: PrismaClient
  /** Resolved tenant id, or `null` for super-admin global content. */
  tenantId: string | null
  /** Tenant slug — used for cache keys and revalidation. `"admin"` for global. */
  tenantSlug: string
  isGlobal?: boolean
  /** When true, enforce the workspace plan's content-entry limit on create. */
  enforcePlan?: boolean
}

function assertActorStatusAllowed(actor: ContentActor, status: string): ServiceResult<WorkflowStatus> {
  if (!isWorkflowStatus(status)) return fail("invalid_status", "Invalid content status")
  if (actorMayOnlyDraft(actor) && status !== "DRAFT") {
    return fail("forbidden", "This account may only create or edit draft content")
  }
  return done(status)
}

function assertWorkflowTransition(
  actor: ContentActor,
  from: WorkflowStatus,
  to: WorkflowStatus,
): ServiceResult<true> {
  if (from === to) return done(true)
  if (actor.kind === "system") return done(true)
  if (actor.kind === "staff") {
    if (!canUserTransition(from, to, actor.role, actor.customPermissions)) {
      return fail("forbidden", `You do not have permission to change status from ${from} to ${to}`)
    }
    return done(true)
  }
  // member / public already constrained to DRAFT by assertActorStatusAllowed
  return done(true)
}

// ── CREATE ───────────────────────────────────────────────────────────────

export interface CreateEntryInput {
  contentTypeSlug: string
  data: Record<string, unknown>
  status?: string
  locale?: string | null
  scheduledAt?: Date | string | null
}

export async function createContentEntry(
  ctx: EntryWriteContext,
  actor: ContentActor,
  input: CreateEntryInput,
): Promise<ServiceResult<ContentEntry>> {
  const { client, tenantId, tenantSlug } = ctx

  if (!input.data || typeof input.data !== "object" || Array.isArray(input.data)) {
    return fail("validation", "Content data must be an object")
  }

  const status = input.status ?? "DRAFT"
  const statusCheck = assertActorStatusAllowed(actor, status)
  if (!statusCheck.ok) return statusCheck
  const targetStatus = statusCheck.data

  const ctResult = await resolveWritableContentType(client, input.contentTypeSlug, { tenantId, isGlobal: ctx.isGlobal })
  if (!ctResult.ok) return ctResult
  const { contentType, fields } = ctResult.data

  const localeResult = await resolveWriteLocale(client, tenantId, input.locale)
  if (!localeResult.ok) return localeResult
  const locale = localeResult.data

  const scheduledAt = normalizeScheduledAt(input.scheduledAt)
  const scheduleError = validateScheduledPublicationDate(targetStatus, scheduledAt)
  if (scheduleError) return fail("validation", scheduleError)

  const transition = assertWorkflowTransition(actor, "DRAFT", targetStatus)
  if (!transition.ok) return transition

  if (ctx.enforcePlan && tenantId) {
    const { enforcePlanLimit } = await import("@/lib/plan-enforcement")
    const enforcement = await enforcePlanLimit(
      tenantId,
      "content_entries",
      actor.kind === "staff" || actor.kind === "system" ? actorUserId(actor) ?? undefined : undefined,
    )
    if (!enforcement.allowed) return fail("plan_limit", enforcement.message ?? "Plan limit reached")
  }

  const enforceRequired = targetStatus !== "DRAFT"

  const schemaValidation = await validateContentEntry(fields as any, input.data, { enforceRequired })
  if (!schemaValidation.success) {
    return fail("validation", "Validation failed", schemaValidation.errors ?? undefined)
  }
  const validatedData: Record<string, unknown> = { ...input.data, ...(schemaValidation.data ?? {}) }

  if (tenantId) {
    const dynamic = await validateDynamicContent(contentType.id, tenantId, validatedData, undefined, {
      enforceRequired,
      client,
    })
    if (!dynamic.success) return fail("validation", "Validation failed", dynamic.errors ?? undefined)
  }

  const dataWithSlugs = await processAutoSlugs(
    tenantId,
    contentType.id,
    fields,
    validatedData as Record<string, any>,
    undefined,
    "content",
    client,
  )

  let finalData: Record<string, unknown> = dataWithSlugs
  if (tenantId) {
    const beforeCreate = await executeSyncHooks(tenantId, WebhookEvents.BEFORE_CREATE, finalData as Record<string, unknown>)
    if (!beforeCreate.allowed) return fail("rejected_by_hook", beforeCreate.rejectMessage || "Rejected by hook")
    finalData = (beforeCreate.modifiedData as Record<string, unknown>) || finalData

    if (targetStatus === "PUBLISHED") {
      const beforePublish = await executeSyncHooks(tenantId, WebhookEvents.BEFORE_PUBLISH, finalData as Record<string, unknown>)
      if (!beforePublish.allowed) return fail("rejected_by_hook", beforePublish.rejectMessage || "Rejected by publish hook")
      finalData = (beforePublish.modifiedData as Record<string, unknown>) || finalData
    }
  }

  const uid = actorUserId(actor)
  const ts = timestampsFor(targetStatus, null, scheduledAt)

  const entry = await client.$transaction(async (tx) => {
    const created = await tx.contentEntry.create({
      data: {
        contentTypeId: contentType.id,
        tenantId,
        locale,
        data: finalData as any,
        status: targetStatus as any,
        publishedAt: ts.publishedAt ?? null,
        scheduledAt: ts.scheduledAt ?? null,
        createdBy: uid,
        updatedBy: uid,
      },
    })
    // documentId defaults to the row's own id for a first locale.
    const withDoc = await tx.contentEntry.update({
      where: { id: created.id },
      data: { documentId: created.id },
    })
    await snapshotVersion(tx as PrismaClient, created.id, finalData, "created", uid, ts.publishedAt ?? null)
    return withDoc
  })

  if (tenantId) {
    triggerWebhooks(tenantId, WebhookEvents.CONTENT_CREATED, {
      entry: { id: entry.id, contentType: input.contentTypeSlug, status: entry.status },
    }).catch(() => {})
    if (entry.status === "PUBLISHED") {
      triggerWebhooks(tenantId, WebhookEvents.CONTENT_PUBLISHED, {
        entry: { id: entry.id, contentType: input.contentTypeSlug, status: entry.status },
      }).catch(() => {})
    }
  }

  await invalidateContentCaches(tenantSlug, input.contentTypeSlug)
  logAudit({
    tenantId: tenantId ?? undefined,
    userId: uid ?? undefined,
    action: AuditAction.CONTENT_CREATED,
    entity: "content_entry",
    entityId: entry.id,
    data: { contentType: input.contentTypeSlug, status: entry.status, locale },
  })

  return done(entry)
}

// ── UPDATE (incl. translation flow + shared-field sync) ───────────────────

export interface UpdateEntryInput {
  contentTypeSlug: string
  entryId: string
  /** Omit to change only the status. */
  data?: Record<string, unknown>
  status?: string
  locale?: string | null
  scheduledAt?: Date | string | null
}

export async function updateContentEntry(
  ctx: EntryWriteContext,
  actor: ContentActor,
  input: UpdateEntryInput,
): Promise<ServiceResult<ContentEntry>> {
  const { client, tenantId, tenantSlug } = ctx

  if (input.data !== undefined && (!input.data || typeof input.data !== "object" || Array.isArray(input.data))) {
    return fail("validation", "Content data must be an object")
  }

  const ctResult = await resolveWritableContentType(client, input.contentTypeSlug, { tenantId, isGlobal: ctx.isGlobal })
  if (!ctResult.ok) return ctResult
  const { contentType, fields } = ctResult.data

  const localeResult = await resolveWriteLocale(client, tenantId, input.locale)
  if (!localeResult.ok) return localeResult
  const targetLocale = localeResult.data

  const baseEntry = await client.contentEntry.findFirst({
    where: {
      id: input.entryId,
      contentTypeId: contentType.id,
      OR: tenantId === null ? [{ tenantId: null }] : [{ tenantId }, { tenantId: null }],
    },
  })
  if (!baseEntry) return fail("not_found", "Entry not found")

  const documentId = baseEntry.documentId || baseEntry.id

  let existingLocaleEntry: ContentEntry | null =
    baseEntry.locale === targetLocale
      ? baseEntry
      : await client.contentEntry.findFirst({
          where: {
            documentId,
            locale: targetLocale,
            OR: tenantId === null ? [{ tenantId: null }] : [{ tenantId }, { tenantId: null }],
          },
        })

  const prevStatus = (existingLocaleEntry?.status ?? "DRAFT") as WorkflowStatus
  const targetStatusRaw = input.status ?? existingLocaleEntry?.status ?? "DRAFT"
  const statusCheck = assertActorStatusAllowed(actor, targetStatusRaw)
  if (!statusCheck.ok) return statusCheck
  const targetStatus = statusCheck.data

  // Ownership — staff "author"/"contributor" and members with ownershipRequired
  // may only touch entries they created.
  const ownerId = existingLocaleEntry?.createdBy ?? baseEntry.createdBy
  if (actor.kind === "staff" && (actor.role === "author" || actor.role === "contributor")) {
    if (ownerId !== actor.userId) return fail("forbidden", "You do not have permission to edit content you do not own")
  }
  if (actor.kind === "member" && actor.ownershipRequired && ownerId !== actor.memberId) {
    return fail("forbidden", "You can only modify entries you created")
  }

  const transition = existingLocaleEntry
    ? assertWorkflowTransition(actor, prevStatus, targetStatus)
    : assertWorkflowTransition(actor, "DRAFT", targetStatus)
  if (!transition.ok) return transition

  const scheduledAt = normalizeScheduledAt(input.scheduledAt)
  const effectiveScheduledAt = scheduledAt || existingLocaleEntry?.scheduledAt || null
  const scheduleError = validateScheduledPublicationDate(targetStatus, effectiveScheduledAt)
  if (scheduleError) return fail("validation", scheduleError)

  const enforceRequired = targetStatus !== "DRAFT"

  // Validate the merged data if data was supplied.
  let mergedData: Record<string, unknown> | undefined
  if (input.data) {
    const existingData =
      existingLocaleEntry?.data && typeof existingLocaleEntry.data === "object"
        ? (existingLocaleEntry.data as Record<string, unknown>)
        : {}
    const candidate = { ...existingData, ...input.data }
    const withSlugs = await processAutoSlugs(
      tenantId,
      contentType.id,
      fields,
      candidate as Record<string, any>,
      existingLocaleEntry?.id,
      "content",
      client,
    )

    const schemaValidation = await validateContentEntry(fields as any, withSlugs, { enforceRequired })
    if (!schemaValidation.success) {
      return fail("validation", "Validation failed", schemaValidation.errors ?? undefined)
    }

    if (tenantId) {
      const dynamic = await validateDynamicContent(contentType.id, tenantId, withSlugs, existingLocaleEntry?.id, {
        enforceRequired,
        client,
      })
      if (!dynamic.success) return fail("validation", "Validation failed", dynamic.errors ?? undefined)
    }

    mergedData = { ...withSlugs, ...(schemaValidation.data ?? {}) }
  }

  const uid = actorUserId(actor)

  const entry = await client.$transaction(async (tx) => {
    let targetEntryId: string

    if (existingLocaleEntry) {
      let finalData = mergedData
      if (mergedData && tenantId) {
        const beforeUpdate = await executeSyncHooks(tenantId, WebhookEvents.BEFORE_UPDATE, mergedData as Record<string, unknown>)
        if (!beforeUpdate.allowed) throw new Error(beforeUpdate.rejectMessage || "Rejected by hook")
        finalData = (beforeUpdate.modifiedData as Record<string, unknown>) || mergedData
      }
      if (targetStatus === "PUBLISHED" && prevStatus !== "PUBLISHED" && tenantId) {
        const beforePublish = await executeSyncHooks(tenantId, WebhookEvents.BEFORE_PUBLISH, {
          id: existingLocaleEntry.id,
          data: (finalData || existingLocaleEntry.data) as Record<string, unknown>,
          currentStatus: prevStatus,
        })
        if (!beforePublish.allowed) throw new Error(beforePublish.rejectMessage || "Rejected by publish hook")
        finalData = (beforePublish.modifiedData as Record<string, unknown>) || finalData
      }

      const ts = timestampsFor(targetStatus, prevStatus, effectiveScheduledAt)
      const updateData: Record<string, unknown> = { updatedBy: uid }
      if (!existingLocaleEntry.documentId) updateData.documentId = documentId
      if (finalData) updateData.data = finalData as any
      if (input.status || targetStatus !== prevStatus) {
        updateData.status = targetStatus
        if ("publishedAt" in ts) updateData.publishedAt = ts.publishedAt
        if ("scheduledAt" in ts) updateData.scheduledAt = ts.scheduledAt
        if ("archivedAt" in ts) updateData.archivedAt = ts.archivedAt
      }
      await tx.contentEntry.update({ where: { id: existingLocaleEntry.id }, data: updateData })
      targetEntryId = existingLocaleEntry.id
    } else {
      // New translation of an existing document.
      if (!mergedData) throw new Error("Data is required to create a new translation")
      let finalData: Record<string, unknown> = mergedData
      if (tenantId) {
        const beforeCreate = await executeSyncHooks(tenantId, WebhookEvents.BEFORE_CREATE, finalData as Record<string, unknown>)
        if (!beforeCreate.allowed) throw new Error(beforeCreate.rejectMessage || "Rejected by hook")
        finalData = (beforeCreate.modifiedData as Record<string, unknown>) || finalData
        if (targetStatus === "PUBLISHED") {
          const beforePublish = await executeSyncHooks(tenantId, WebhookEvents.BEFORE_PUBLISH, finalData as Record<string, unknown>)
          if (!beforePublish.allowed) throw new Error(beforePublish.rejectMessage || "Rejected by publish hook")
          finalData = (beforePublish.modifiedData as Record<string, unknown>) || finalData
        }
      }
      if (!baseEntry.documentId) {
        await tx.contentEntry.update({ where: { id: baseEntry.id }, data: { documentId } })
      }
      const ts = timestampsFor(targetStatus, null, effectiveScheduledAt)
      const newEntry = await tx.contentEntry.create({
        data: {
          documentId,
          contentTypeId: baseEntry.contentTypeId,
          tenantId,
          locale: targetLocale,
          data: finalData as any,
          status: targetStatus as any,
          publishedAt: ts.publishedAt ?? null,
          scheduledAt: ts.scheduledAt ?? null,
          createdBy: uid,
          updatedBy: uid,
        },
      })
      targetEntryId = newEntry.id
    }

    // Sync non-localizable (shared) fields across every translation.
    if (input.data) {
      const sharedFields = fields.filter((f: any) => !f.localizable)
      if (sharedFields.length > 0) {
        const siblings = await tx.contentEntry.findMany({ where: { documentId, NOT: { id: targetEntryId } } })
        for (const sib of siblings) {
          const sibData = typeof sib.data === "string" ? JSON.parse(sib.data) : (sib.data as Record<string, unknown>)
          let changed = false
          for (const f of sharedFields) {
            if (input.data[f.slug] !== sibData[f.slug]) {
              sibData[f.slug] = input.data[f.slug]
              changed = true
            }
          }
          if (changed) await tx.contentEntry.update({ where: { id: sib.id }, data: { data: sibData as any } })
        }
      }
    }

    const updated = await tx.contentEntry.findUnique({ where: { id: targetEntryId } })
    await snapshotVersion(
      tx as PrismaClient,
      targetEntryId,
      updated?.data,
      existingLocaleEntry ? "updated" : "created",
      uid,
    )
    return updated!
  })

  if (tenantId) {
    const wasCreate = !existingLocaleEntry
    triggerWebhooks(tenantId, wasCreate ? WebhookEvents.CONTENT_CREATED : WebhookEvents.CONTENT_UPDATED, {
      entry: { id: entry.id, contentType: input.contentTypeSlug, status: entry.status },
    }).catch(() => {})
    if (entry.status === "PUBLISHED" && prevStatus !== "PUBLISHED") {
      triggerWebhooks(tenantId, WebhookEvents.CONTENT_PUBLISHED, {
        entry: { id: entry.id, contentType: input.contentTypeSlug, status: entry.status },
      }).catch(() => {})
    } else if (prevStatus === "PUBLISHED" && entry.status === "DRAFT") {
      triggerWebhooks(tenantId, WebhookEvents.CONTENT_UNPUBLISHED, {
        entry: { id: entry.id, contentType: input.contentTypeSlug, status: entry.status },
      }).catch(() => {})
    }
  }

  await invalidateContentCaches(tenantSlug, input.contentTypeSlug)
  logAudit({
    tenantId: tenantId ?? undefined,
    userId: uid ?? undefined,
    action: existingLocaleEntry ? AuditAction.CONTENT_UPDATED : AuditAction.CONTENT_CREATED,
    entity: "content_entry",
    entityId: entry.id,
    data: { contentType: input.contentTypeSlug, status: entry.status, locale: targetLocale },
  })

  return done(entry)
}

// ── STATUS TRANSITION (thin wrapper over update) ─────────────────────────

export async function transitionContentEntryStatus(
  ctx: EntryWriteContext,
  actor: ContentActor,
  input: { contentTypeSlug: string; entryId: string; status: string },
): Promise<ServiceResult<ContentEntry>> {
  const existing = await ctx.client.contentEntry.findFirst({
    where: { id: input.entryId },
    select: { locale: true },
  })
  if (!existing) return fail("not_found", "Entry not found")
  return updateContentEntry(ctx, actor, {
    contentTypeSlug: input.contentTypeSlug,
    entryId: input.entryId,
    status: input.status,
    locale: existing.locale,
  })
}

// ── DELETE ───────────────────────────────────────────────────────────────

export async function deleteContentEntry(
  ctx: EntryWriteContext,
  actor: ContentActor,
  input: { contentTypeSlug: string; entryId: string },
): Promise<ServiceResult<{ id: string }>> {
  const { client, tenantId, tenantSlug } = ctx

  const ctResult = await resolveWritableContentType(client, input.contentTypeSlug, { tenantId, isGlobal: ctx.isGlobal })
  if (!ctResult.ok) return ctResult
  const { contentType } = ctResult.data

  const entry = await client.contentEntry.findFirst({
    where: {
      id: input.entryId,
      contentTypeId: contentType.id,
      OR: tenantId === null ? [{ tenantId: null }] : [{ tenantId }, { tenantId: null }],
    },
  })
  if (!entry) return fail("not_found", "Entry not found")

  // Deletion authority.
  if (actor.kind === "staff") {
    if (actor.role === "author" || actor.role === "contributor") {
      if (entry.createdBy !== actor.userId) {
        return fail("forbidden", "You do not have permission to delete content you do not own")
      }
    } else if (!["admin", "owner", "editor"].includes(actor.role)) {
      return fail("forbidden", "You do not have permission to delete entries")
    }
  } else if (actor.kind === "member") {
    if (actor.ownershipRequired && entry.createdBy !== actor.memberId) {
      return fail("forbidden", "You can only delete entries you created")
    }
  } else if (actor.kind === "public") {
    return fail("forbidden", "Authentication is required to delete content")
  }

  if (tenantId) {
    const beforeDelete = await executeSyncHooks(tenantId, WebhookEvents.BEFORE_DELETE, {
      id: entry.id,
      contentType: input.contentTypeSlug,
    })
    if (!beforeDelete.allowed) return fail("rejected_by_hook", beforeDelete.rejectMessage || "Rejected by hook")
  }

  await client.contentEntry.delete({ where: { id: entry.id } })

  if (tenantId) {
    triggerWebhooks(tenantId, WebhookEvents.CONTENT_DELETED, {
      entry: { id: entry.id, contentType: input.contentTypeSlug },
    }).catch(() => {})
  }

  await invalidateContentCaches(tenantSlug, input.contentTypeSlug)
  logAudit({
    tenantId: tenantId ?? undefined,
    userId: actorUserId(actor) ?? undefined,
    action: AuditAction.CONTENT_DELETED,
    entity: "content_entry",
    entityId: entry.id,
    data: { contentType: input.contentTypeSlug },
  })

  return done({ id: entry.id })
}
