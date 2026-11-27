import { describe, it, expect, vi, beforeEach } from "vitest"
import { getServerSession } from "next-auth"

// Regression tests for two real bugs in updateCmsLandingSectionAction:
//
// 1. It used `upsert` with a compound-unique `where` of
//    `tenantId_singleTypeId: { tenantId: null, ... }` — Prisma's
//    generated selector for a compound unique key requires a real string
//    for every part, and throws "Argument `tenantId` must not be null" at
//    runtime even though the column itself is nullable and a plain
//    `where` filter (used for the `existing` lookup) accepts null fine.
//    This meant Simpan on /admin/cms (the global, tenantId: null landing
//    page) could NEVER actually persist — confirmed by reproducing the
//    real upsert against the local DB. Fixed by branching on `existing`
//    into a plain update/create instead.
//
// 2. Prisma's validation/known-request errors stuff the ENTIRE query
//    argument object (the whole `data: {...}` payload) into `.message`.
//    That was returned to the client as-is and shown verbatim in the
//    "Gagal Menyimpan" toast. Fixed in the catch block to swap any
//    long/Prisma-shaped message for a short, safe one.

vi.mock("@/lib/database", () => {
  const mockDb = {
    singleType: { findFirst: vi.fn() },
    tenantSingleTypeAssignment: { findFirst: vi.fn(), update: vi.fn(), create: vi.fn() },
  }
  return { db: mockDb }
})

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}))

vi.mock("@/lib/auth", () => ({ authOptions: {} }))

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))

vi.mock("@/lib/audit-log", () => ({
  logAudit: vi.fn(),
  AuditAction: { CONTENT_UPDATED: "content.updated" },
}))

vi.mock("@/lib/default-landing-page", () => ({ DEFAULT_LANDING_PAGE_DATA: {} }))

import { db } from "@/lib/database"
import { updateCmsLandingSectionAction } from "@/actions/cms-frontend"

const mockDb = db as any

describe("updateCmsLandingSectionAction", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(getServerSession as any).mockResolvedValue({ user: { id: "admin-1", role: "super_admin" } })
    mockDb.singleType.findFirst.mockResolvedValue({ id: "st-1" })
  })

  it("creates a new row (never an upsert against a null-tenantId compound key) when none exists yet", async () => {
    mockDb.tenantSingleTypeAssignment.findFirst.mockResolvedValue(null)
    mockDb.tenantSingleTypeAssignment.create.mockResolvedValue({ id: "new-1" })

    const result = await updateCmsLandingSectionAction("features", [{ title: "test" }])

    expect(result).toEqual({ success: true })
    expect(mockDb.tenantSingleTypeAssignment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ tenantId: null, singleTypeId: "st-1", data: { features: [{ title: "test" }] } }),
    })
    expect(mockDb.tenantSingleTypeAssignment.update).not.toHaveBeenCalled()
  })

  it("updates the existing row by its own id when one is already found", async () => {
    mockDb.tenantSingleTypeAssignment.findFirst.mockResolvedValue({ id: "existing-1", data: { hero_title: "old" } })
    mockDb.tenantSingleTypeAssignment.update.mockResolvedValue({ id: "existing-1" })

    const result = await updateCmsLandingSectionAction("features", [{ title: "test" }])

    expect(result).toEqual({ success: true })
    expect(mockDb.tenantSingleTypeAssignment.update).toHaveBeenCalledWith({
      where: { id: "existing-1" },
      data: expect.objectContaining({ data: { hero_title: "old", features: [{ title: "test" }] } }),
    })
    expect(mockDb.tenantSingleTypeAssignment.create).not.toHaveBeenCalled()
  })

  it("replaces a raw Prisma validation dump with a short, readable message", async () => {
    mockDb.tenantSingleTypeAssignment.findFirst.mockResolvedValue(null)
    const hugePrismaDump = `\nInvalid \`prisma.tenantSingleTypeAssignment.create()\` invocation:\n\n${"x".repeat(500)}`
    mockDb.tenantSingleTypeAssignment.create.mockRejectedValue(new Error(hugePrismaDump))

    const result = await updateCmsLandingSectionAction("features", [{ title: "test" }])

    expect("error" in result && result.error).toBe("Gagal menyimpan: data tidak sesuai format yang diharapkan.")
    expect("error" in result && result.error!.length).toBeLessThan(100)
  })

  it("keeps a short, deliberate error message as-is", async () => {
    mockDb.tenantSingleTypeAssignment.findFirst.mockResolvedValue(null)
    mockDb.tenantSingleTypeAssignment.create.mockRejectedValue(new Error("Connection timeout"))

    const result = await updateCmsLandingSectionAction("features", [{ title: "test" }])

    expect("error" in result && result.error).toBe("Connection timeout")
  })
})
