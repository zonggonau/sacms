import { describe, it, expect, vi, beforeEach } from "vitest"

const calls: string[] = []
vi.mock("server-only", () => ({}))
vi.mock("@/lib/database", () => ({
  db: { tenant: { findUnique: vi.fn(async () => ({ name: "Toko Uji" })) } },
  getTenantDb: vi.fn(async () => ({ tenantDb: true })),
}))
vi.mock("@/lib/schema-wipe", () => ({
  wipeTenantSchema: vi.fn(async () => {
    calls.push("wipe")
    return { contentTypes: 2, singleTypes: 1, components: 3 }
  }),
}))
vi.mock("@/lib/infrastructure/default-tenant-schema", () => ({
  seedDefaultTenantSchema: vi.fn(async () => {
    calls.push("seed")
  }),
}))
vi.mock("@/lib/schema-lock", () => ({ finalizeSchema: vi.fn(async () => {}) }))
vi.mock("@/lib/infrastructure/site-settings", () => ({
  ensureSiteSettings: vi.fn(async () => {
    calls.push("site-settings")
  }),
}))

import { resetSchemaToStarter } from "@/lib/schema-reset"
import { finalizeSchema } from "@/lib/schema-lock"
import { getTenantDb } from "@/lib/database"
import { ensureSiteSettings } from "@/lib/infrastructure/site-settings"

describe("resetSchemaToStarter", () => {
  beforeEach(() => {
    calls.length = 0
  })

  it("wipes the workspace schema first, then imports the default starter, then restores site-settings", async () => {
    const deleted = await resetSchemaToStarter("tenant-1", "toko")
    expect(calls).toEqual(["wipe", "seed", "site-settings"])
    expect(finalizeSchema).toHaveBeenCalledWith("tenant-1")
    expect(deleted).toEqual({ contentTypes: 2, singleTypes: 1, components: 3 })
    expect(getTenantDb).toHaveBeenCalledWith("toko")
    expect(ensureSiteSettings).toHaveBeenCalledWith("tenant-1", "Toko Uji")
  })
})
