import { describe, it, expect, vi, beforeEach } from "vitest"

// Regression test for a real feature gap found 2026-10-25: GraphQL's
// createEntry/updateEntry mutations never created a ContentVersion
// snapshot, unlike the REST/dashboard path (src/lib/content/entry-service.ts),
// so content authored/edited through GraphQL had no version history or
// restore capability. Fixed by reusing entry-service.ts's own
// snapshotVersion() helper (now exported) inside both resolvers'
// transactions.

vi.mock("@/lib/slug", () => ({
  processAutoSlugs: vi.fn(async (_tenantId: string, _typeId: string, _fields: any[], data: any) => data),
}))

vi.mock("@/lib/webhooks", () => ({
  executeSyncHooks: vi.fn(async () => ({ allowed: true, modifiedData: undefined })),
  triggerWebhooks: vi.fn(),
  WebhookEvents: {
    BEFORE_CREATE: "content.beforeCreate",
    BEFORE_UPDATE: "content.beforeUpdate",
    CONTENT_CREATED: "content.created",
    CONTENT_UPDATED: "content.updated",
  },
}))

vi.mock("@/lib/audit-log", () => ({
  logAudit: vi.fn(),
  AuditAction: { CONTENT_CREATED: "content.created", CONTENT_UPDATED: "content.updated" },
}))

vi.mock("@/lib/database", () => ({ db: {} }))

function makeMockDb(contentType: any, existingEntry: any, createdEntry: any, updatedAfterDocId: any) {
  const tx = {
    contentEntry: {
      create: vi.fn().mockResolvedValue(createdEntry),
      update: vi.fn().mockResolvedValue(updatedAfterDocId),
    },
    contentVersion: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({}),
    },
  }
  return {
    contentType: { findFirst: vi.fn().mockResolvedValue(contentType) },
    tenantLocale: { findFirst: vi.fn().mockResolvedValue({ locale: "id" }) },
    contentEntry: { findFirst: vi.fn().mockResolvedValue(existingEntry) },
    $transaction: vi.fn(async (fn: any) => fn(tx)),
    __tx: tx,
  }
}

describe("GraphQL mutation resolvers create ContentVersion snapshots", () => {
  beforeEach(() => vi.clearAllMocks())

  it("resolveMutationCreate snapshots a version 1 'created' entry inside its transaction", async () => {
    const { resolveMutationCreate } = await import("@/lib/graphql-schema")
    const contentType = { id: "ct1", schemaFields: [] }
    const createdEntry = { id: "e1", data: { title: "Hello" }, publishedAt: null, locale: "id", status: "DRAFT", createdAt: new Date(), updatedAt: new Date() }
    const updatedEntry = { ...createdEntry, documentId: "e1" }
    const mockDb = makeMockDb(contentType, null, createdEntry, updatedEntry)

    await resolveMutationCreate("tenant1", "posts", { data: { title: "Hello" } }, mockDb as any, "user1")

    expect(mockDb.__tx.contentVersion.create).toHaveBeenCalledTimes(1)
    const call = mockDb.__tx.contentVersion.create.mock.calls[0][0]
    expect(call.data).toMatchObject({ contentEntryId: "e1", version: 1, changeType: "created", changedBy: "user1" })
  })

  it("resolveMutationUpdate snapshots a version 'updated' entry inside its transaction", async () => {
    const { resolveMutationUpdate } = await import("@/lib/graphql-schema")
    const contentType = { id: "ct1", schemaFields: [] }
    const existing = { id: "e1", data: { title: "Old" }, contentTypeId: "ct1" }
    const updatedEntry = { id: "e1", data: { title: "New" }, publishedAt: null, status: "DRAFT", locale: "id", createdAt: new Date(), updatedAt: new Date() }
    const mockDb = makeMockDb(contentType, existing, updatedEntry, updatedEntry)
    mockDb.__tx.contentEntry.update.mockResolvedValue(updatedEntry)

    await resolveMutationUpdate("tenant1", "posts", { id: "e1", data: { title: "New" } }, mockDb as any, "user1")

    expect(mockDb.__tx.contentVersion.create).toHaveBeenCalledTimes(1)
    const call = mockDb.__tx.contentVersion.create.mock.calls[0][0]
    expect(call.data).toMatchObject({ contentEntryId: "e1", version: 1, changeType: "updated", changedBy: "user1" })
  })
})
