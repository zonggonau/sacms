import { describe, it, expect, vi, beforeEach } from "vitest"
import { getServerSession } from "next-auth"

// Regression test for a real tenant-isolation bug found 2026-10-25:
// these admin-only "global content" actions used `tenantId: undefined` in
// their Prisma `where` clauses, intending to scope to global (tenantId IS
// NULL) rows. Prisma treats `undefined` as "no filter on this field at
// all", so every lookup here silently matched ANY tenant's row with a
// matching id/slug — deleteAdminEntryAction could then delete a real
// tenant's content on an id collision. Fixed to `tenantId: null`, which
// this test locks in by asserting on the actual Prisma call arguments.

vi.mock("@/lib/database", () => {
  const mockDb = {
    contentType: { findFirst: vi.fn() },
    contentEntry: { findFirst: vi.fn(), delete: vi.fn() },
  }
  return { db: mockDb }
})

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}))

vi.mock("@/lib/auth", () => ({ authOptions: {} }))

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))

vi.mock("@/lib/cache", () => ({ invalidatePattern: vi.fn() }))

vi.mock("@/lib/audit-log", () => ({
  logAudit: vi.fn(),
  AuditAction: { CONTENT_DELETED: "content.deleted" },
}))

import { db } from "@/lib/database"
import { deleteAdminEntryAction } from "@/actions/admin-content"

const mockDb = db as any

describe("deleteAdminEntryAction — tenant isolation", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(getServerSession as any).mockResolvedValue({ user: { id: "admin1", role: "super_admin" } })
  })

  it("filters both the content type and entry lookups by tenantId: null, never undefined", async () => {
    mockDb.contentType.findFirst.mockResolvedValue({ id: "ct1" })
    mockDb.contentEntry.findFirst.mockResolvedValue({ id: "entry1" })
    mockDb.contentEntry.delete.mockResolvedValue({ id: "entry1" })

    await deleteAdminEntryAction("sacms-footer", "entry1")

    expect(mockDb.contentType.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenantId: null }) })
    )
    expect(mockDb.contentEntry.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenantId: null }) })
    )

    // The one thing `tenantId: undefined` would have silently bypassed:
    // neither call's where clause may omit tenantId (which is what
    // `undefined` effectively does to a Prisma filter).
    const ctWhere = mockDb.contentType.findFirst.mock.calls[0][0].where
    const entryWhere = mockDb.contentEntry.findFirst.mock.calls[0][0].where
    expect(Object.keys(ctWhere)).toContain("tenantId")
    expect(Object.keys(entryWhere)).toContain("tenantId")
    expect(ctWhere.tenantId).not.toBeUndefined()
    expect(entryWhere.tenantId).not.toBeUndefined()
  })

  it("refuses to delete when the entry lookup finds nothing (e.g. the id belongs to a real tenant's row, correctly excluded by tenantId: null)", async () => {
    mockDb.contentType.findFirst.mockResolvedValue({ id: "ct1" })
    mockDb.contentEntry.findFirst.mockResolvedValue(null)

    const result = await deleteAdminEntryAction("sacms-footer", "some-other-tenants-entry")

    expect(result).toEqual({ error: "Entry not found" })
    expect(mockDb.contentEntry.delete).not.toHaveBeenCalled()
  })
})
