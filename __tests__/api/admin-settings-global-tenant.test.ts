import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("next-auth", () => ({ getServerSession: vi.fn(async () => ({ user: { id: "admin-1", role: "super_admin" } })) }))
vi.mock("@/lib/auth", () => ({ authOptions: {} }))
vi.mock("@/lib/audit-log", () => ({ logAudit: vi.fn(), AuditAction: { SETTINGS_UPDATED: "settings_updated" } }))
vi.mock("@/lib/settings", () => ({
  getPlatformSettings: vi.fn(async () => ({ globalTenantId: "sacms-global", registrationMode: "open" })),
  syncPlatformSettingsCache: vi.fn(),
}))
vi.mock("@/lib/settings-secrets", () => ({
  maskSecretSettings: (s: unknown) => s,
  isSecretSettingKey: () => false,
  isUnchangedSecretValue: () => false,
}))

import { db } from "@/lib/database"
import { PUT } from "@/app/api/admin/settings/route"

const put = (settings: Record<string, unknown>) =>
  PUT(new Request("https://admin.test/api/admin/settings", { method: "PUT", body: JSON.stringify({ settings }) }) as never, { params: Promise.resolve({}) } as never)

describe("PUT /api/admin/settings — Global workspace id is copy-only", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(db as unknown as { setting: { upsert: ReturnType<typeof vi.fn> } }).setting.upsert = vi.fn(async () => ({}))
  })

  it("rejects re-pointing the Global workspace id and writes nothing", async () => {
    const res = await put({ globalTenantId: "wks_0123456789abcdef01234567", registrationMode: "closed" })
    expect(res.status).toBe(400)
    expect((db as any).setting.upsert).not.toHaveBeenCalled()
  })

  it("still saves the page when the id is sent back unchanged", async () => {
    const res = await put({ globalTenantId: "sacms-global", registrationMode: "closed" })
    expect(res.status).toBe(200)
    expect((db as any).setting.upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { key: "registrationMode" } }))
  })
})
