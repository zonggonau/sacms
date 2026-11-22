import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("server-only", () => ({}))

// ensurePublicSubdomainToken generates and persists a random 16-hex-char
// identifier for a tenant's public `*.sites.sacms.cloud` subdomain label —
// decoupled from Tenant.slug so a long/descriptive slug can never push that
// domain's SSL certificate Common Name past the issuer's 64-character
// limit (confirmed live on a demo subdomain built from a long template
// slug: "The common name is longer than 64 characters").

const tenantFindUnique = vi.fn()
const tenantFindFirst = vi.fn()
const tenantUpdate = vi.fn()
vi.mock("@/lib/database", () => ({
  db: {
    tenant: {
      findUnique: (...args: any[]) => tenantFindUnique(...args),
      findFirst: (...args: any[]) => tenantFindFirst(...args),
      update: (...args: any[]) => tenantUpdate(...args),
    },
  },
}))

const { ensurePublicSubdomainToken } = await import("@/lib/infrastructure/public-subdomain")

describe("ensurePublicSubdomainToken", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns the already-persisted token without writing anything, so the public URL stays stable across redeploys", async () => {
    tenantFindUnique.mockResolvedValue({ publicSubdomainToken: "deadbeef01234567" })

    const token = await ensurePublicSubdomainToken("tenant-1")

    expect(token).toBe("deadbeef01234567")
    expect(tenantFindFirst).not.toHaveBeenCalled()
    expect(tenantUpdate).not.toHaveBeenCalled()
  })

  it("generates a new 16-hex-char token and persists it when the tenant has none yet", async () => {
    tenantFindUnique.mockResolvedValue({ publicSubdomainToken: null })
    tenantFindFirst.mockResolvedValue(null) // no collision
    tenantUpdate.mockResolvedValue({})

    const token = await ensurePublicSubdomainToken("tenant-2")

    expect(token).toMatch(/^[0-9a-f]{16}$/)
    expect(tenantUpdate).toHaveBeenCalledWith({ where: { id: "tenant-2" }, data: { publicSubdomainToken: token } })
  })

  it("regenerates on a collision instead of persisting a duplicate token onto two tenants", async () => {
    tenantFindUnique.mockResolvedValue({ publicSubdomainToken: null })
    tenantFindFirst
      .mockResolvedValueOnce({ id: "other-tenant" }) // first candidate collides
      .mockResolvedValueOnce(null) // second candidate is free
    tenantUpdate.mockResolvedValue({})

    const token = await ensurePublicSubdomainToken("tenant-3")

    expect(tenantFindFirst).toHaveBeenCalledTimes(2)
    expect(tenantUpdate).toHaveBeenCalledWith({ where: { id: "tenant-3" }, data: { publicSubdomainToken: token } })
  })
})
