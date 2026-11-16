import { describe, it, expect, vi, beforeEach } from "vitest"

// ensureSiteSettings() guarantees every workspace has a `site-settings`
// Single Type (brand/logo/favicon/colors/mode) with one content entry —
// idempotent, never touching an existing one.

const singleTypeFindFirst = vi.fn()
const singleTypeCreate = vi.fn()
const tenantSingleTypeAssignmentUpsert = vi.fn().mockResolvedValue({})

const tenantDbMock = {
  singleType: { findFirst: singleTypeFindFirst, create: singleTypeCreate },
  tenantSingleTypeAssignment: { upsert: tenantSingleTypeAssignmentUpsert },
}

vi.mock("@/lib/database", () => ({
  getTenantDbById: vi.fn(async () => tenantDbMock),
}))

const { ensureSiteSettings, SITE_SETTINGS_SLUG } = await import("@/lib/infrastructure/site-settings")

describe("ensureSiteSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    tenantSingleTypeAssignmentUpsert.mockResolvedValue({})
  })

  it("creates the site-settings Single Type with all 11 fields when none exists yet", async () => {
    singleTypeFindFirst.mockResolvedValue(null)
    singleTypeCreate.mockResolvedValue({ id: "st_site_settings" })

    await ensureSiteSettings("tenant-1", "Toko Kopi Nabire")

    expect(singleTypeFindFirst).toHaveBeenCalledWith({ where: { tenantId: "tenant-1", slug: SITE_SETTINGS_SLUG } })
    expect(singleTypeCreate).toHaveBeenCalledTimes(1)
    const createArgs = singleTypeCreate.mock.calls[0][0]
    expect(createArgs.data.slug).toBe("site-settings")
    expect(createArgs.data.tenantId).toBe("tenant-1")
    const fieldSlugs = createArgs.data.schemaFields.create.map((f: any) => f.slug)
    expect(fieldSlugs).toEqual([
      "brand-name",
      "tagline",
      "logo",
      "favicon",
      "default-color-mode",
      "primary-color-light",
      "primary-color-dark",
      "secondary-color-light",
      "secondary-color-dark",
      "text-color-light",
      "text-color-dark",
    ])
    // Color fields use the "color" type; logo/favicon use "media"; mode uses "select" with 3 choices.
    const byslug = Object.fromEntries(createArgs.data.schemaFields.create.map((f: any) => [f.slug, f]))
    expect(byslug["primary-color-light"].type).toBe("color")
    expect(byslug.logo.type).toBe("media")
    expect(byslug["default-color-mode"].type).toBe("select")
    expect(byslug["default-color-mode"].options.choices).toHaveLength(3)
  })

  it("seeds the initial content entry with the tenant's name as the default brand name", async () => {
    singleTypeFindFirst.mockResolvedValue(null)
    singleTypeCreate.mockResolvedValue({ id: "st_site_settings" })

    await ensureSiteSettings("tenant-1", "Toko Kopi Nabire")

    expect(tenantSingleTypeAssignmentUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId_singleTypeId_locale: { tenantId: "tenant-1", singleTypeId: "st_site_settings", locale: "id" } },
        create: expect.objectContaining({
          data: expect.objectContaining({
            "brand-name": "Toko Kopi Nabire",
            "default-color-mode": "system",
            "primary-color-light": "#1D4ED8",
          }),
        }),
      }),
    )
  })

  it("does not create a second Single Type when site-settings already exists", async () => {
    singleTypeFindFirst.mockResolvedValue({ id: "st_existing" })

    await ensureSiteSettings("tenant-1", "Toko Kopi Nabire")

    expect(singleTypeCreate).not.toHaveBeenCalled()
  })

  it("never overwrites an existing content entry — the upsert's update branch is a no-op", async () => {
    singleTypeFindFirst.mockResolvedValue({ id: "st_existing" })

    await ensureSiteSettings("tenant-1", "Toko Kopi Nabire")

    expect(tenantSingleTypeAssignmentUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: {} }),
    )
  })
})
