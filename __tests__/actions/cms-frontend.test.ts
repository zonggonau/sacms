import { describe, it, expect, vi, beforeEach } from "vitest"
import { getServerSession } from "next-auth"

// Regression test: when a saved section's shape doesn't match what Prisma
// expects (e.g. after a super admin hand-edits an exported JSON file and
// re-imports a malformed version — see the Export/Import JSON buttons on
// /admin/cms), Prisma's own validation/known-request errors stuff the
// ENTIRE query argument object (the whole `data: {...}` payload) into
// `.message`. That was returned to the client as-is and shown verbatim in
// the "Gagal Menyimpan" toast — the user saw a giant JSON dump instead of
// a readable error. Fixed in updateCmsLandingSectionAction's catch block
// to swap any long/Prisma-shaped message for a short, safe one.

vi.mock("@/lib/database", () => {
  const mockDb = {
    singleType: { findFirst: vi.fn() },
    tenantSingleTypeAssignment: { findFirst: vi.fn(), upsert: vi.fn() },
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

describe("updateCmsLandingSectionAction — error message sanitization", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(getServerSession as any).mockResolvedValue({ user: { id: "admin-1", role: "super_admin" } })
    mockDb.singleType.findFirst.mockResolvedValue({ id: "st-1" })
    mockDb.tenantSingleTypeAssignment.findFirst.mockResolvedValue(null)
  })

  it("replaces a raw Prisma validation dump with a short, readable message", async () => {
    const hugePrismaDump = `\nInvalid \`prisma.tenantSingleTypeAssignment.upsert()\` invocation:\n\n${"x".repeat(500)}`
    mockDb.tenantSingleTypeAssignment.upsert.mockRejectedValue(new Error(hugePrismaDump))

    const result = await updateCmsLandingSectionAction("features", [{ title: "test" }])

    expect("error" in result && result.error).toBe("Gagal menyimpan: data tidak sesuai format yang diharapkan.")
    expect("error" in result && result.error!.length).toBeLessThan(100)
  })

  it("keeps a short, deliberate error message as-is", async () => {
    mockDb.tenantSingleTypeAssignment.upsert.mockRejectedValue(new Error("Connection timeout"))

    const result = await updateCmsLandingSectionAction("features", [{ title: "test" }])

    expect("error" in result && result.error).toBe("Connection timeout")
  })

  it("still saves normally on success", async () => {
    mockDb.tenantSingleTypeAssignment.upsert.mockResolvedValue({})

    const result = await updateCmsLandingSectionAction("features", [{ title: "test" }])

    expect(result).toEqual({ success: true })
  })
})
