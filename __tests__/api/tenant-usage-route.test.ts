import { beforeEach, describe, expect, it, vi } from "vitest"

const MB = 1024 * 1024
const { db, tenantDb, limits } = vi.hoisted(() => ({
  db: { apiRequest: { findMany: vi.fn(async () => []) } },
  tenantDb: { contentType: { count: vi.fn(async () => 2) }, contentEntry: { count: vi.fn(async () => 0) } },
  limits: {
    storage: vi.fn(),
    api: vi.fn(async () => ({ max: 100000 })),
    content: vi.fn(async () => ({ max: 999999999 })),
  },
}))

vi.mock("@/lib/database", () => ({ db, getTenantDb: vi.fn(async () => tenantDb) }))
vi.mock("@/lib/tenant-plan", () => ({
  getTenantPlanConfig: vi.fn(async () => ({ plan_slug: "pro", max_content_types: 999999, max_storage: 5120, max_api_calls: 100000 })),
}))
vi.mock("@/lib/api/route-helpers", () => ({
  withStaffAuth: (handler: any) => (req: any, ctx: any) => handler(req, ctx, { access: { tenantId: "tenant-1" } }),
}))
vi.mock("@/lib/plan-enforcement", async () => {
  const actual: any = await vi.importActual("@/lib/plan-enforcement")
  return {
    ...actual,
    enforcePlanLimit: vi.fn((_tenantId: string, resource: string) =>
      resource === "storage" ? limits.storage() : resource === "api_calls" ? limits.api() : limits.content(),
    ),
  }
})

import { GET } from "@/app/api/tenant/[tenant]/usage/route"

const call = async () => {
  const res = await (GET as any)({} as Request, { params: Promise.resolve({ tenant: "acme" }) })
  return res.json()
}

describe("GET /api/tenant/[tenant]/usage — storage units", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    tenantDb.contentType.count.mockResolvedValue(2)
  })

  it("reports the plan cap in MB, so a 5 GB plan reads 5120 MB rather than a byte count", async () => {
    limits.storage.mockResolvedValue({ max: 5120 * MB, current: 3 * MB, allowed: true })
    const body = await call()
    expect(body.plan.max_storage).toBe(5120)
    expect(body.usage.storageMB).toBe(3)
  })

  it("maps an uncapped storage quota to the sentinel the tab shows as Unlimited", async () => {
    limits.storage.mockResolvedValue({ max: Number.MAX_SAFE_INTEGER, current: 3 * MB, allowed: true })
    const body = await call()
    expect(body.plan.max_storage).toBe(999999999)
  })
})
