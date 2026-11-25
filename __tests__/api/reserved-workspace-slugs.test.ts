import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("next-auth", () => ({ getServerSession: vi.fn(async () => ({ user: { id: "user-1", role: "user" } })) }))
vi.mock("@/lib/auth", () => ({ authOptions: {} }))
vi.mock("@/lib/settings", () => ({ getGlobalWorkspaceId: vi.fn(async () => "sacms-global") }))
vi.mock("@/lib/infrastructure/site-settings", () => ({ ensureSiteSettings: vi.fn(async () => undefined) }))
vi.mock("@/lib/infrastructure/default-tenant-schema", () => ({ seedDefaultTenantSchema: vi.fn(async () => undefined) }))
vi.mock("@/lib/infrastructure/public-subdomain", () => ({ ensurePublicSubdomainToken: vi.fn(async () => "token") }))

const { tx } = vi.hoisted(() => ({
  tx: { tenant: { create: vi.fn() }, tenantMember: { create: vi.fn() } },
}))
vi.mock("@/lib/workspace-creation-limit", () => ({
  withWorkspaceCreation: vi.fn(async (_userId: string, _plan: string, run: (t: typeof tx) => Promise<unknown>) => ({ ok: true, value: await run(tx) })),
}))

import { db } from "@/lib/database"
import { getGlobalWorkspaceId } from "@/lib/settings"
import { isReservedWorkspaceSlug } from "@/lib/reserved-workspace-slugs"
import { POST } from "@/app/api/tenant/create/route"

const create = (body: Record<string, unknown>) =>
  POST(new Request("https://app.test/api/tenant/create", { method: "POST", body: JSON.stringify(body) }) as never)

describe("reserved workspace slugs", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(db.tenant.findUnique).mockResolvedValue(null)
    tx.tenant.create.mockImplementation(async ({ data }) => ({ id: "tenant-new", ...data }))
    tx.tenantMember.create.mockResolvedValue({})
  })

  it("flags the system slugs and whatever globalTenantId currently is", async () => {
    for (const slug of ["sacms-global", "SACMS", "system"]) expect(await isReservedWorkspaceSlug(slug)).toBe(true)
    vi.mocked(getGlobalWorkspaceId).mockResolvedValueOnce("platform-root")
    expect(await isReservedWorkspaceSlug("platform-root")).toBe(true)
    expect(await isReservedWorkspaceSlug("toko-budi")).toBe(false)
  })

  it.each([
    ["a name that slugifies to it", { name: "SaCMS Global" }],
    ["an explicit custom slug", { name: "Anything", slug: "sacms-global" }],
  ])("never hands out the Global slug via %s", async (_label, body) => {
    const res = await create(body)
    expect(res.status).toBeLessThan(400)
    const { slug } = tx.tenant.create.mock.calls[0][0].data
    expect(slug).not.toBe("sacms-global")
    expect(await isReservedWorkspaceSlug(slug)).toBe(false)
  })

  it("leaves ordinary names untouched", async () => {
    await create({ name: "Toko Budi" })
    expect(tx.tenant.create.mock.calls[0][0].data.slug).toBe("toko-budi")
  })
})
