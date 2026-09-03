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
  deleteContentEntry,
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

  it("lets a member delete their own entry", async () => {
    const client = makeClient({
      contentEntry: {
        findFirst: vi.fn().mockResolvedValue({ id: "e1", createdBy: "m1" }),
        delete: vi.fn().mockResolvedValue({}),
      },
    })
    const res = await deleteContentEntry(
      ctx(client),
      { kind: "member", memberId: "m1", ownershipRequired: true },
      { contentTypeSlug: "posts", entryId: "e1" },
    )
    expect(res.ok).toBe(true)
    if (res.ok) expect(res.data.id).toBe("e1")
  })
})
