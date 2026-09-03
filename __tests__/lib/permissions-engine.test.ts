import { describe, it, expect, vi, beforeEach } from "vitest"
import { canPerform, resolveRoleFromJwt, SYSTEM_ROLES } from "@/lib/permissions-engine"
import { db } from "@/lib/database"

vi.mock("@/lib/redis", () => ({ getRedis: () => null }))
vi.mock("@/lib/database", () => ({
  db: {
    memberRole: { findFirst: vi.fn(), findMany: vi.fn(), createMany: vi.fn() },
  },
}))

const findFirst = vi.mocked(db.memberRole.findFirst)

describe("permissions-engine", () => {
  beforeEach(() => vi.clearAllMocks())

  describe("resolveRoleFromJwt", () => {
    it("returns 'public' for a null payload", () => {
      expect(resolveRoleFromJwt(null)).toBe(SYSTEM_ROLES.PUBLIC)
    })
    it("returns 'public' when the payload has no role", () => {
      expect(resolveRoleFromJwt({})).toBe(SYSTEM_ROLES.PUBLIC)
    })
    it("returns the payload role when present", () => {
      expect(resolveRoleFromJwt({ role: "vip-member" })).toBe("vip-member")
    })
  })

  describe("canPerform — public role defaults", () => {
    it("allows find/findOne, denies writes when no rows are persisted", async () => {
      findFirst.mockResolvedValue(null as any)
      expect(await canPerform("t1", "public", "posts", "find")).toBe(true)
      expect(await canPerform("t1", "public", "posts", "findOne")).toBe(true)
      expect(await canPerform("t1", "public", "posts", "create")).toBe(false)
      expect(await canPerform("t1", "public", "posts", "delete")).toBe(false)
    })
  })

  describe("canPerform — authenticated role defaults", () => {
    it("allows create but denies update/delete when no rows are persisted", async () => {
      findFirst.mockResolvedValue(null as any)
      expect(await canPerform("t1", "authenticated", "posts", "create")).toBe(true)
      expect(await canPerform("t1", "authenticated", "posts", "update")).toBe(false)
    })
  })

  describe("canPerform — persisted rows win over defaults", () => {
    it("honours an explicit grant on a system role", async () => {
      findFirst.mockResolvedValue({
        id: "r1",
        slug: "public",
        isSystem: true,
        permissions: [{ contentTypeSlug: "posts", action: "create", granted: true }],
      } as any)
      // explicit grant present
      expect(await canPerform("t1", "public", "posts", "create")).toBe(true)
      // not listed, and no wildcard row -> deny
      expect(await canPerform("t1", "public", "comments", "create")).toBe(false)
    })

    it("specific content-type rule overrides the wildcard rule", async () => {
      findFirst.mockResolvedValue({
        id: "r2",
        slug: "vip-member",
        isSystem: false,
        permissions: [
          { contentTypeSlug: "*", action: "update", granted: true },
          { contentTypeSlug: "posts", action: "update", granted: false },
        ],
      } as any)
      expect(await canPerform("t1", "vip-member", "articles", "update")).toBe(true)
      expect(await canPerform("t1", "vip-member", "posts", "update")).toBe(false)
    })

    it("denies by default when neither specific nor wildcard rule matches", async () => {
      findFirst.mockResolvedValue({
        id: "r3",
        slug: "vip-member",
        isSystem: false,
        permissions: [{ contentTypeSlug: "posts", action: "find", granted: true }],
      } as any)
      expect(await canPerform("t1", "vip-member", "posts", "delete")).toBe(false)
    })
  })

  describe("canPerform — unknown custom role", () => {
    it("falls back to authenticated defaults", async () => {
      findFirst.mockResolvedValue(null as any)
      expect(await canPerform("t1", "ghost-role", "posts", "find")).toBe(true)
      expect(await canPerform("t1", "ghost-role", "posts", "delete")).toBe(false)
    })
  })
})
