import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/lib/cache", () => ({ invalidatePattern: vi.fn().mockResolvedValue(undefined) }))
vi.mock("@/lib/audit-log", () => ({ logAudit: vi.fn(), AuditAction: { CONTENT_CREATED: "c", CONTENT_UPDATED: "u", CONTENT_DELETED: "d" } }))
vi.mock("@/lib/webhooks", () => ({
  executeSyncHooks: vi.fn().mockResolvedValue({ allowed: true }),
  triggerWebhooks: vi.fn().mockResolvedValue(undefined),
  WebhookEvents: {
    BEFORE_CREATE: "bc", BEFORE_UPDATE: "bu", BEFORE_DELETE: "bd", BEFORE_PUBLISH: "bp",
    CONTENT_CREATED: "cc", CONTENT_UPDATED: "cu", CONTENT_DELETED: "cd", CONTENT_PUBLISHED: "cp", CONTENT_UNPUBLISHED: "cun",
  },
}))
vi.mock("@/lib/validations/dynamic-validator", () => ({
  validateDynamicContent: vi.fn().mockResolvedValue({ success: true, errors: {} }),
}))
vi.mock("@/lib/slug", () => ({ processAutoSlugs: vi.fn(async (_t, _id, _f, data) => data) }))
vi.mock("@/lib/database", () => ({ db: {} }))

import {
  generateDocumentId,
  normalizeScheduledAt,
  createContentEntry,
  updateContentEntry,
  deleteContentEntry,
  restoreContentEntry,
  permanentlyDeleteContentEntry,
} from "@/lib/content/entry-service"

function makeClient(overrides: any = {}) {
  const client: any = {
    contentType: {
      findFirst: vi.fn().mockResolvedValue({
        id: "ct1",
        slug: "posts",
        tenantId: "t1",
        schemaFields: [{ slug: "title", type: "text", required: true, localizable: true }],
        tenants: [{ tenantId: "t1", enabled: true }],
      }),
    },
    tenantLocale: { findMany: vi.fn().mockResolvedValue([{ locale: "en", isDefault: true }]) },
    contentEntry: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn().mockResolvedValue({}),
    },
    contentVersion: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({}) },
    $transaction: vi.fn(async (cb: any) =>
      cb({
        contentEntry: {
          create: vi.fn().mockResolvedValue({ id: "e1", data: { title: "Hi" }, status: "DRAFT" }),
          update: vi.fn().mockResolvedValue({ id: "e1", documentId: "e1", data: { title: "Hi" }, status: "DRAFT", locale: "en" }),
          findUnique: vi.fn().mockResolvedValue({ id: "e1", documentId: "e1", data: { title: "Hi" }, status: "DRAFT", locale: "en" }),
          findMany: vi.fn().mockResolvedValue([]),
        },
        contentVersion: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn() },
      }),
    ),
    ...overrides,
  }
  return client
}

const ctx = (client: any) => ({ client, tenantId: "t1", tenantSlug: "acme" })

describe("content entry service — primitives", () => {
  it("generateDocumentId produces a v4 UUID", () => {
    expect(generateDocumentId()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  })

  it("normalizeScheduledAt handles Date, ISO string, and nullish", () => {
    const d = new Date("2030-01-01T00:00:00Z")
    expect(normalizeScheduledAt(d)).toBe(d)
    expect(normalizeScheduledAt("2030-01-01T00:00:00Z")?.getTime()).toBe(d.getTime())
    expect(normalizeScheduledAt(null)).toBeNull()
    expect(normalizeScheduledAt("not-a-date")).toBeNull()
  })
})

describe("createContentEntry", () => {
  beforeEach(() => vi.clearAllMocks())

  it("rejects a non-object data payload", async () => {
    const res = await createContentEntry(ctx(makeClient()), { kind: "system" }, {
      contentTypeSlug: "posts",
      data: null as any,
    })
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.code).toBe("validation")
  })

  it("forces a member actor to DRAFT even if PUBLISHED is requested", async () => {
    const res = await createContentEntry(ctx(makeClient()), { kind: "member", memberId: "m1" }, {
      contentTypeSlug: "posts",
      data: { title: "Hi" },
      status: "PUBLISHED",
    })
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.code).toBe("forbidden")
  })

  it("fails validation when a required field is missing and status is not DRAFT", async () => {
    const res = await createContentEntry(ctx(makeClient()), { kind: "system" }, {
      contentTypeSlug: "posts",
      data: {},
      status: "PUBLISHED",
    })
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.code).toBe("validation")
  })

  it("allows Studio to publish with a hidden field still required for other callers", async () => {
    const client = makeClient({
      contentType: { findFirst: vi.fn().mockResolvedValue({
        id: "ct1", slug: "posts", tenantId: "t1",
        schemaFields: [
          { slug: "title", name: "Title", type: "text", required: true },
          { slug: "internal", name: "Internal", type: "text", required: true, options: { showInCms: false } },
        ],
        tenants: [{ tenantId: "t1", enabled: true }],
      }) },
    })
    const input = { contentTypeSlug: "posts", data: { title: "Ready" }, status: "PUBLISHED" }
    expect(await createContentEntry(ctx(client), { kind: "system" }, input)).toMatchObject({ ok: false, code: "validation" })
    expect(await createContentEntry({ ...ctx(client), studio: true }, { kind: "system" }, input)).toMatchObject({ ok: true })
  })

  it("creates a DRAFT entry for a system actor", async () => {
    const res = await createContentEntry(ctx(makeClient()), { kind: "system" }, {
      contentTypeSlug: "posts",
      data: { title: "Hi" },
      status: "DRAFT",
    })
    expect(res.ok).toBe(true)
    if (res.ok) expect(res.data.id).toBe("e1")
  })

  it("404s when the content type is not found", async () => {
    const client = makeClient({ contentType: { findFirst: vi.fn().mockResolvedValue(null) } })
    const res = await createContentEntry(ctx(client), { kind: "system" }, { contentTypeSlug: "ghost", data: { title: "x" } })
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.code).toBe("not_found")
  })
})

describe("updateContentEntry — status-only transitions must still validate the effective data", () => {
  beforeEach(() => vi.clearAllMocks())

  // A real, confirmed bug (chatgpt6.md): UpdateEntryInput.data is
  // documented as "Omit to change only the status", and the validation
  // block used to be gated entirely on `input.data` being truthy — so a
  // DRAFT entry missing a required field (allowed while it's a draft)
  // could be pushed straight to PUBLISHED via a status-only call with no
  // `data` at all, never re-validated against PUBLISHED's stricter rules.

  function makeExistingDraftEntry(data: Record<string, unknown>) {
    return makeClient({
      contentEntry: {
        findFirst: vi.fn().mockResolvedValue({
          id: "e1",
          documentId: "e1",
          contentTypeId: "ct1",
          tenantId: "t1",
          locale: "en",
          status: "DRAFT",
          data,
          createdBy: null,
          updatedAt: new Date(),
        }),
        update: vi.fn(),
      },
    })
  }

  it("rejects a status-only PUBLISHED transition when the existing draft is missing a required field", async () => {
    const client = makeExistingDraftEntry({}) // "title" (required) was never filled in
    const res = await updateContentEntry(ctx(client), { kind: "system" }, {
      contentTypeSlug: "posts",
      entryId: "e1",
      status: "PUBLISHED",
      // No `data` — status-only, per this field's own documented contract.
    })
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.code).toBe("validation")
  })

  it("allows a status-only PUBLISHED transition when the existing data already satisfies required fields", async () => {
    const client = makeExistingDraftEntry({ title: "Already valid" })
    const res = await updateContentEntry(ctx(client), { kind: "system" }, {
      contentTypeSlug: "posts",
      entryId: "e1",
      status: "PUBLISHED",
    })
    expect(res.ok).toBe(true)
  })

  it("does not require validation for a status-only transition that stays within DRAFT-tier requirements (e.g. DRAFT -> DRAFT)", async () => {
    const client = makeExistingDraftEntry({}) // still missing "title", but enforceRequired is false for DRAFT
    const res = await updateContentEntry(ctx(client), { kind: "system" }, {
      contentTypeSlug: "posts",
      entryId: "e1",
      status: "DRAFT",
    })
    expect(res.ok).toBe(true)
  })
})

describe("Studio saves for a selected locale", () => {
  const updatedAt = new Date("2025-01-01T00:00:00Z")
  const savedEntry = {
    id: "entry-en",
    documentId: "entry-en",
    contentTypeId: "ct1",
    tenantId: "t1",
    locale: "en",
    status: "PUBLISHED",
    data: { title: "Original" },
    updatedAt,
  }
  const actor = { kind: "staff", role: "owner", userId: "editor" } as const

  it("saves with the selected row's timestamp and preserves publication when status is omitted", async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 })
    const persisted = { ...savedEntry, data: { title: "Edited" } }
    const client = makeClient({
      contentEntry: { findFirst: vi.fn().mockResolvedValue(savedEntry) },
      $transaction: vi.fn(async (run) => run({
        contentEntry: { updateMany, findUnique: vi.fn().mockResolvedValue(persisted) },
        contentVersion: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn() },
      })),
    })

    const result = await updateContentEntry(ctx(client), actor, {
      contentTypeSlug: "posts",
      entryId: savedEntry.id,
      locale: "en",
      expectedUpdatedAt: updatedAt.toISOString(),
      data: { title: "Edited" },
    })

    expect(result).toEqual({ ok: true, data: persisted })
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: savedEntry.id, updatedAt, deletedAt: null },
      data: { updatedBy: "editor", data: { title: "Edited" } },
    })
  })

  it("does not snapshot or save when another writer updates the row before the guarded write", async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 0 })
    const createVersion = vi.fn()
    const client = makeClient({
      contentEntry: { findFirst: vi.fn().mockResolvedValue(savedEntry) },
      $transaction: vi.fn(async (run) => run({
        contentEntry: { updateMany },
        contentVersion: { create: createVersion },
      })),
    })

    const result = await updateContentEntry(ctx(client), actor, {
      contentTypeSlug: "posts",
      entryId: savedEntry.id,
      locale: "en",
      expectedUpdatedAt: updatedAt,
      data: { title: "Edited" },
    })

    expect(result).toMatchObject({ ok: false, code: "conflict" })
    expect(createVersion).not.toHaveBeenCalled()
  })

  it("does not overwrite a new translation created before taking the document lock", async () => {
    const create = vi.fn()
    const lock = vi.fn()
    const findTranslation = vi.fn().mockResolvedValue({ id: "entry-id" })
    const client = makeClient({
      tenantLocale: { findMany: vi.fn().mockResolvedValue([{ locale: "en" }, { locale: "id" }]) },
      contentEntry: { findFirst: vi.fn().mockResolvedValueOnce(savedEntry).mockResolvedValueOnce(null) },
      $transaction: vi.fn(async (run) => run({
        $queryRaw: lock,
        contentEntry: { create, findFirst: findTranslation },
      })),
    })

    const result = await updateContentEntry(ctx(client), actor, {
      contentTypeSlug: "posts",
      entryId: savedEntry.id,
      locale: "id",
      expectedLocaleMissing: true,
      data: { title: "Terjemahan" },
    })

    expect(result).toMatchObject({ ok: false, code: "conflict" })
    expect(lock).toHaveBeenCalledOnce()
    expect(findTranslation).toHaveBeenCalledWith({
      where: { documentId: savedEntry.documentId, locale: "id", contentTypeId: "ct1", tenantId: "t1", deletedAt: null },
      select: { id: true },
    })
    expect(create).not.toHaveBeenCalled()
  })
})

describe("deleteContentEntry", () => {
  beforeEach(() => vi.clearAllMocks())

  it("forbids an anonymous public actor", async () => {
    const client = makeClient({
      contentEntry: { findFirst: vi.fn().mockResolvedValue({ id: "e1", createdBy: null }) },
    })
    const res = await deleteContentEntry(ctx(client), { kind: "public" }, { contentTypeSlug: "posts", entryId: "e1" })
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.code).toBe("forbidden")
  })

  it("blocks a member from deleting an entry they do not own when ownership is required", async () => {
    const client = makeClient({
      contentEntry: {
        findFirst: vi.fn().mockResolvedValue({ id: "e1", createdBy: "someone-else" }),
        delete: vi.fn(),
      },
    })
    const res = await deleteContentEntry(
      ctx(client),
      { kind: "member", memberId: "m1", ownershipRequired: true },
      { contentTypeSlug: "posts", entryId: "e1" },
    )
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.code).toBe("forbidden")
  })

  it("lets a member delete their own entry (soft-delete, not a hard row delete)", async () => {
    const update = vi.fn().mockResolvedValue({})
    const client = makeClient({
      contentEntry: {
        findFirst: vi.fn().mockResolvedValue({ id: "e1", createdBy: "m1" }),
        update,
      },
    })
    const res = await deleteContentEntry(
      ctx(client),
      { kind: "member", memberId: "m1", ownershipRequired: true },
      { contentTypeSlug: "posts", entryId: "e1" },
    )
    expect(res.ok).toBe(true)
    if (res.ok) expect(res.data.id).toBe("e1")
    expect(update).toHaveBeenCalledWith({ where: { id: "e1" }, data: { deletedAt: expect.any(Date) } })
  })
})

describe("restoreContentEntry", () => {
  beforeEach(() => vi.clearAllMocks())

  it("restores a trashed entry back out of the trash", async () => {
    const update = vi.fn().mockResolvedValue({})
    const client = makeClient({
      contentEntry: {
        findFirst: vi.fn().mockResolvedValue({ id: "e1", createdBy: "m1", deletedAt: new Date() }),
        update,
      },
    })
    const res = await restoreContentEntry(
      ctx(client),
      { kind: "member", memberId: "m1", ownershipRequired: true },
      { contentTypeSlug: "posts", entryId: "e1" },
    )
    expect(res.ok).toBe(true)
    expect(update).toHaveBeenCalledWith({ where: { id: "e1" }, data: { deletedAt: null } })
  })

  it("404s when the entry isn't actually in the trash", async () => {
    const client = makeClient({
      contentEntry: { findFirst: vi.fn().mockResolvedValue(null) },
    })
    const res = await restoreContentEntry(ctx(client), { kind: "system" }, { contentTypeSlug: "posts", entryId: "e1" })
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.code).toBe("not_found")
  })
})

describe("permanentlyDeleteContentEntry", () => {
  beforeEach(() => vi.clearAllMocks())

  it("hard-deletes an entry already in the trash", async () => {
    const del = vi.fn().mockResolvedValue({})
    const client = makeClient({
      contentEntry: {
        findFirst: vi.fn().mockResolvedValue({ id: "e1", createdBy: "m1", deletedAt: new Date() }),
        delete: del,
      },
    })
    const res = await permanentlyDeleteContentEntry(
      ctx(client),
      { kind: "member", memberId: "m1", ownershipRequired: true },
      { contentTypeSlug: "posts", entryId: "e1" },
    )
    expect(res.ok).toBe(true)
    expect(del).toHaveBeenCalledWith({ where: { id: "e1" } })
  })

  it("404s when the entry isn't in the trash", async () => {
    const client = makeClient({
      contentEntry: { findFirst: vi.fn().mockResolvedValue(null) },
    })
    const res = await permanentlyDeleteContentEntry(ctx(client), { kind: "system" }, { contentTypeSlug: "posts", entryId: "e1" })
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.code).toBe("not_found")
  })
})
