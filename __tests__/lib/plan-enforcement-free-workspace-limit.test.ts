import { describe, it, expect, vi, beforeEach } from "vitest"
import { db } from "@/lib/database"
import { validateWorkspacePlanBinding } from "@/lib/plan-enforcement"

vi.mock("@/lib/database", () => {
  const mockDb = {
    user: { findUnique: vi.fn() },
  }
  return { db: mockDb, getTenantDb: vi.fn() }
})

describe("validateWorkspacePlanBinding — one free workspace per account, ever", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("allows a free workspace when the account has never used one", async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue({ freeWorkspaceUsed: false } as any)

    const result = await validateWorkspacePlanBinding("user-1", "free")

    expect(result.allowed).toBe(true)
  })

  it("blocks a second free workspace once the account has already used its one allowance", async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue({ freeWorkspaceUsed: true } as any)

    const result = await validateWorkspacePlanBinding("user-1", "free")

    expect(result.allowed).toBe(false)
    expect(result.message).toMatch(/satu workspace gratis/i)
  })

  it("is case-insensitive about the plan slug", async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue({ freeWorkspaceUsed: true } as any)

    const result = await validateWorkspacePlanBinding("user-1", "FREE")

    expect(result.allowed).toBe(false)
  })

  it("never touches the DB and always allows non-free plans, regardless of freeWorkspaceUsed", async () => {
    const result = await validateWorkspacePlanBinding("user-1", "pro")

    expect(result.allowed).toBe(true)
    expect(db.user.findUnique).not.toHaveBeenCalled()
  })
})
