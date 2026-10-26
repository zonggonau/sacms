import { describe, it, expect, vi, beforeEach } from "vitest"
import { db } from "@/lib/database"
import { validateWorkspacePlanBinding } from "@/lib/plan-enforcement"

vi.mock("@/lib/database", () => {
  const mockDb = {
    user: { findUnique: vi.fn() },
  }
  return { db: mockDb, getTenantDb: vi.fn() }
})

describe("validateWorkspacePlanBinding — free workspace needs a free account AND an unused allowance", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("allows a free workspace for a free-account user who has never used one", async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue({ plan: "free", freeWorkspaceUsed: false } as any)

    const result = await validateWorkspacePlanBinding("user-1", "free")

    expect(result.allowed).toBe(true)
  })

  it("blocks a second free workspace once a free-account user has already used its one allowance", async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue({ plan: "free", freeWorkspaceUsed: true } as any)

    const result = await validateWorkspacePlanBinding("user-1", "free")

    expect(result.allowed).toBe(false)
    expect(result.message).toMatch(/satu workspace gratis/i)
  })

  it.each(["starter", "pro", "business"])(
    "blocks a free workspace outright for an account on the %s plan, even if never used before",
    async (accountPlan) => {
      vi.mocked(db.user.findUnique).mockResolvedValue({ plan: accountPlan, freeWorkspaceUsed: false } as any)

      const result = await validateWorkspacePlanBinding("user-1", "free")

      expect(result.allowed).toBe(false)
      expect(result.message).toMatch(/hanya tersedia untuk akun dengan paket gratis/i)
    },
  )

  it("is case-insensitive about the requested workspace plan slug", async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue({ plan: "free", freeWorkspaceUsed: true } as any)

    const result = await validateWorkspacePlanBinding("user-1", "FREE")

    expect(result.allowed).toBe(false)
  })

  it("never touches the DB and always allows non-free plans, regardless of account plan or freeWorkspaceUsed", async () => {
    const result = await validateWorkspacePlanBinding("user-1", "pro")

    expect(result.allowed).toBe(true)
    expect(db.user.findUnique).not.toHaveBeenCalled()
  })
})
