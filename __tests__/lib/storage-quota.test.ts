import { describe, it, expect, beforeEach, vi } from "vitest"

vi.mock("@/lib/tenant-plan", () => ({
  getTenantPlanConfig: vi.fn(),
  getUserPlanConfig: vi.fn(),
}))
vi.mock("@/lib/license", () => ({ isEnterpriseTenant: vi.fn() }))
vi.mock("@/lib/settings", () => ({ getGlobalWorkspaceId: vi.fn().mockResolvedValue("global-ws") }))

import { db } from "@/lib/database"
import { getTenantPlanConfig } from "@/lib/tenant-plan"
import { isEnterpriseTenant } from "@/lib/license"
import { checkStorageUpload, enforcePlanLimit, getStorageQuota } from "@/lib/plan-enforcement"
import { STORAGE_ADDON_BYTES, addOneMonth, grantStorageAddon } from "@/lib/billing/storage-addon"

const MB = 1024 * 1024
const mockDb = db as any

function setWorkspace({
  planMb = 100,
  plan = "pro",
  sizeBytes = 0,
  variantBytes = 0,
  addonBytes = 0,
  storageConfig = null as unknown,
  overrideMb = null as number | null,
} = {}) {
  vi.mocked(getTenantPlanConfig).mockResolvedValue({ plan_slug: plan, max_storage: planMb } as any)
  mockDb.tenant.findUnique = vi.fn().mockResolvedValue({ storageConfig, plan })
  mockDb.customPlanOverride = { findUnique: vi.fn().mockResolvedValue(overrideMb === null ? null : { maxStorage: overrideMb }) }
  mockDb.media.aggregate = vi.fn().mockResolvedValue({ _sum: { size: sizeBytes, variantBytes } })
  mockDb.storageAddon = {
    aggregate: vi.fn().mockResolvedValue({ _sum: { bytes: addonBytes ? BigInt(addonBytes) : null } }),
    upsert: vi.fn(async ({ create }: any) => create),
  }
}

describe("storage quota", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(isEnterpriseTenant).mockResolvedValue(false)
    mockDb.user.findUnique = vi.fn().mockResolvedValue({ role: "owner" })
  })

  it("counts generated image versions and adds only active add-ons to the plan quota", async () => {
    setWorkspace({ planMb: 100, sizeBytes: 30 * MB, variantBytes: 2 * MB, addonBytes: STORAGE_ADDON_BYTES })

    const quota = await getStorageQuota("t1")

    expect(quota).toMatchObject({ usedBytes: 32 * MB, planBytes: 100 * MB, addonBytes: STORAGE_ADDON_BYTES })
    expect(quota.limitBytes).toBe(100 * MB + STORAGE_ADDON_BYTES)
    const where = mockDb.storageAddon.aggregate.mock.calls[0][0].where
    expect(where.tenantId).toBe("t1")
    expect(where.expiresAt.gt).toBeInstanceOf(Date)
    expect(where.startsAt.lte).toBeInstanceOf(Date)
  })

  it("uses the admin override instead of the plan quota", async () => {
    setWorkspace({ planMb: 100, overrideMb: 500 })
    expect((await getStorageQuota("t1")).limitBytes).toBe(500 * MB)
  })

  // Regression: the upload check added the new files in MB to usage in bytes, so a nearly
  // full workspace could still upload a large file.
  it("rejects an upload that would go over the quota even while usage is still under it", async () => {
    setWorkspace({ planMb: 100, sizeBytes: 99 * MB })

    const result = await checkStorageUpload("t1", 5 * MB)

    expect(result.allowed).toBe(false)
    expect(result.message).toContain("Kuota storage workspace tidak cukup")
    expect((await checkStorageUpload("t1", 1 * MB)).allowed).toBe(true)
  })

  it("meters Enterprise-named plans and super admins like everyone else", async () => {
    setWorkspace({ planMb: 100, plan: "enterprise-vps", sizeBytes: 100 * MB })
    mockDb.user.findUnique = vi.fn().mockResolvedValue({ role: "super_admin" })

    const result = await enforcePlanLimit("t1", "storage", "admin-user")

    expect(result).toMatchObject({ allowed: false, current: 100 * MB, max: 100 * MB })
  })

  it("does not meter a workspace that stores media in its own bucket (BYOS)", async () => {
    setWorkspace({ planMb: 100, sizeBytes: 900 * MB, storageConfig: { endpoint: "https://s3.example.com" } })

    expect((await getStorageQuota("t1")).limitBytes).toBeNull()
    expect((await checkStorageUpload("t1", 500 * MB)).allowed).toBe(true)
  })

  it("does not meter an instance running under an enterprise license", async () => {
    setWorkspace({ planMb: 100, sizeBytes: 900 * MB })
    vi.mocked(isEnterpriseTenant).mockResolvedValue(true)

    expect((await getStorageQuota("t1")).limitBytes).toBeNull()
    expect(isEnterpriseTenant).toHaveBeenCalledWith("global-ws")
  })

  it("falls back to original sizes when a connected database has no variantBytes column", async () => {
    setWorkspace({ planMb: 100 })
    mockDb.media.aggregate = vi
      .fn()
      .mockRejectedValueOnce(new Error("column variantBytes does not exist"))
      .mockResolvedValueOnce({ _sum: { size: 10 * MB } })

    expect((await getStorageQuota("t1")).usedBytes).toBe(10 * MB)
  })
})

describe("storage add-on", () => {
  beforeEach(() => {
    mockDb.storageAddon = { upsert: vi.fn(async ({ create }: any) => create) }
  })

  it("grants 10 GB for one month, once per payment order", async () => {
    const now = new Date("2026-09-17T10:00:00Z")

    await grantStorageAddon("t1", "ADD-170920261001", { now })

    const args = mockDb.storageAddon.upsert.mock.calls[0][0]
    expect(args.where).toEqual({ orderId: "ADD-170920261001" })
    expect(args.update).toEqual({})
    expect(args.create).toMatchObject({ tenantId: "t1", bytes: BigInt(STORAGE_ADDON_BYTES), startsAt: now })
    expect(args.create.expiresAt.toISOString()).toBe("2026-10-17T10:00:00.000Z")
  })

  it("ends on the last day of a shorter month", () => {
    expect(addOneMonth(new Date("2026-01-31T00:00:00Z")).toISOString()).toBe("2026-02-28T00:00:00.000Z")
    expect(addOneMonth(new Date("2028-01-31T00:00:00Z")).toISOString()).toBe("2028-02-29T00:00:00.000Z")
    expect(addOneMonth(new Date("2026-12-15T00:00:00Z")).toISOString()).toBe("2027-01-15T00:00:00.000Z")
  })
})
