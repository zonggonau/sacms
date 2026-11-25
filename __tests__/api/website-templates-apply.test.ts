import { describe, it, expect, vi, beforeEach } from "vitest"
import type { Prisma } from "@/lib/database"

vi.mock("server-only", () => ({}))
vi.mock("next-auth", () => ({ getServerSession: vi.fn() }))
vi.mock("@/lib/auth", () => ({ authOptions: {} }))
vi.mock("@/lib/tenant-access", () => ({ getTenantAccess: vi.fn() }))

const { fakeTenantDb, fakeSetting } = vi.hoisted(() => ({
  fakeTenantDb: {
    contentType: { findFirst: vi.fn() },
    singleType: { findFirst: vi.fn() },
    component: { findFirst: vi.fn() },
  },
  fakeSetting: {
    findUnique: vi.fn<() => Promise<{ value: string } | null>>(),
    upsert: vi.fn<(args: Prisma.SettingUpsertArgs) => Promise<{ value: string }>>(),
    updateMany: vi.fn<(args: Prisma.SettingUpdateManyArgs) => Promise<{ count: number }>>(),
    deleteMany: vi.fn<(args?: Prisma.SettingDeleteManyArgs) => Promise<{ count: number }>>(),
  },
}))

vi.mock("@/lib/database", () => ({
  db: {
    mcpDeploymentSource: { create: vi.fn().mockResolvedValue({ id: "rev-1" }) },
    websiteTemplate: { findUnique: vi.fn() },
    tenant: { update: vi.fn().mockResolvedValue({}) },
    setting: fakeSetting,
    $transaction: vi.fn(),
  },
  getTenantDb: vi.fn().mockResolvedValue(fakeTenantDb),
}))

vi.mock("@/lib/schema-template-sync", () => ({
  materializeSchemaIntoTenant: vi.fn().mockResolvedValue({ imported: 3 }),
}))

vi.mock("@/lib/infrastructure/deploy-frontend", () => ({
  deployTenantFrontend: vi.fn().mockResolvedValue({ url: "https://acme.sites.sacms.cloud", deploymentId: "dpl_1", state: "QUEUED", simulated: false }),
}))

vi.mock("@/lib/infrastructure/frontend-env", () => ({
  resolveApiOrigin: vi.fn().mockReturnValue("https://sacms.cloud"),
  resolveWebsiteTemplateEnvVars: vi.fn().mockResolvedValue([]),
  getTenantCustomEnvVarList: vi.fn().mockResolvedValue([]),
  setTenantCustomEnvVars: vi.fn().mockResolvedValue(undefined),
}))

import { getServerSession } from "next-auth"
import { getTenantAccess } from "@/lib/tenant-access"
import { db } from "@/lib/database"
import { materializeSchemaIntoTenant } from "@/lib/schema-template-sync"
import { deployTenantFrontend } from "@/lib/infrastructure/deploy-frontend"
import {
  resolveWebsiteTemplateEnvVars,
  getTenantCustomEnvVarList,
  setTenantCustomEnvVars,
} from "@/lib/infrastructure/frontend-env"
import { POST } from "@/app/api/tenant/[tenant]/website-templates/[id]/apply/route"

const mockSession = vi.mocked(getServerSession)
const mockAccess = vi.mocked(getTenantAccess)

const ctx = (params: Record<string, string>) => ({ params: Promise.resolve(params) })
const req = () => new Request("https://api.test/x", { method: "POST" }) as any

const paidAccess = { role: "admin", tenantId: "tenant1", userId: "user1", isGlobal: false, tenant: { id: "tenant1", name: "Acme", slug: "acme", plan: "business" } }

const fakeTemplate = {
  id: "wt1",
  published: true,
  files: [{ path: "app/page.tsx", content: "export default function Page() { return null }" }],
  schemaTemplate: { id: "st1", schema: { contentTypes: [{ name: "Post", slug: "post", fields: [] }], singleTypes: [], components: [] } },
}

describe("POST /api/tenant/[tenant]/website-templates/[id]/apply", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSession.mockResolvedValue({ user: { id: "user1", role: "owner" } } as any)
    mockAccess.mockResolvedValue(paidAccess as any)
    fakeTenantDb.contentType.findFirst.mockResolvedValue(null)
    fakeTenantDb.singleType.findFirst.mockResolvedValue(null)
    fakeTenantDb.component.findFirst.mockResolvedValue(null)
    let state: string | null = null
    fakeSetting.findUnique.mockImplementation(async () => state ? { value: state } : null)
    fakeSetting.upsert.mockImplementation(async ({ create }) => {
      state ??= create.value
      return { value: state }
    })
    fakeSetting.updateMany.mockImplementation(async ({ where, data }) => {
      if (state !== where?.value) return { count: 0 }
      state = data.value as string
      return { count: 1 }
    })
    fakeSetting.deleteMany.mockImplementation(async ({ where } = {}) => {
      if (state !== where?.value) return { count: 0 }
      state = null
      return { count: 1 }
    })
    vi.mocked(db.$transaction).mockImplementation(async (run: any) => {
      const before = state
      try { return await run(db) } catch (error) { state = before; throw error }
    })
  })

  it("404s when the website template doesn't exist", async () => {
    vi.mocked(db.websiteTemplate.findUnique).mockResolvedValue(null)
    const res = await POST(req(), ctx({ tenant: "acme", id: "wt1" }))
    expect(res.status).toBe(404)
  })

  it("404s for a regular tenant when the template is a draft (not published)", async () => {
    vi.mocked(db.websiteTemplate.findUnique).mockResolvedValue({ ...fakeTemplate, published: false } as any)
    const res = await POST(req(), ctx({ tenant: "acme", id: "wt1" }))
    expect(res.status).toBe(404)
    expect(materializeSchemaIntoTenant).not.toHaveBeenCalled()
  })

  it.each(["free", "starter", "enterprise", "custom"])("blocks a %s-plan workspace with a plan_limit error, before touching the workspace schema", async (plan) => {
    vi.mocked(db.websiteTemplate.findUnique).mockResolvedValue(fakeTemplate as any)
    mockAccess.mockResolvedValue({ ...paidAccess, tenant: { ...paidAccess.tenant, plan } } as any)
    const res = await POST(req(), ctx({ tenant: "acme", id: "wt1" }))
    expect(res.status).toBe(403)
    expect(JSON.stringify(await res.json())).toMatch(/Pro dan Business/)
    expect(materializeSchemaIntoTenant).not.toHaveBeenCalled()
    expect(deployTenantFrontend).not.toHaveBeenCalled()
  })

  it("lets a Pro-plan workspace apply a template", async () => {
    vi.mocked(db.websiteTemplate.findUnique).mockResolvedValue(fakeTemplate as any)
    mockAccess.mockResolvedValue({ ...paidAccess, tenant: { ...paidAccess.tenant, plan: "pro" } } as any)
    const res = await POST(req(), ctx({ tenant: "acme", id: "wt1" }))
    expect(res.status).toBe(200)
  })

  it("rejects when the workspace already has a Content Type (not empty)", async () => {
    vi.mocked(db.websiteTemplate.findUnique).mockResolvedValue(fakeTemplate as any)
    fakeTenantDb.contentType.findFirst.mockResolvedValue({ id: "ct1" })
    const res = await POST(req(), ctx({ tenant: "acme", id: "wt1" }))
    expect(res.status).toBe(400)
    expect(materializeSchemaIntoTenant).not.toHaveBeenCalled()
    expect(deployTenantFrontend).not.toHaveBeenCalled()
  })

  it("materializes the linked schema and deploys the bundled files on the happy path", async () => {
    vi.mocked(db.websiteTemplate.findUnique).mockResolvedValue(fakeTemplate as any)

    const res = await POST(req(), ctx({ tenant: "acme", id: "wt1" }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(fakeTenantDb.singleType.findFirst).toHaveBeenCalledWith({
      where: { tenantId: "tenant1", slug: { not: "site-settings" } },
      select: { id: true },
    })
    expect(materializeSchemaIntoTenant).toHaveBeenCalledWith(fakeTenantDb, "tenant1", fakeTemplate.schemaTemplate.schema, {}, {
      mergeSingleTypeSlug: "site-settings",
    })
    expect(deployTenantFrontend).not.toHaveBeenCalled()
    expect(body.imported).toBe(3)
    expect(body.sourceRevision).toBe("rev-1")
    expect(setTenantCustomEnvVars).not.toHaveBeenCalled()
    expect(body.envVarsApplied).toEqual([])
    expect(db.tenant.update).toHaveBeenCalledWith({
      where: { id: "tenant1" },
      data: { sourceWebsiteTemplateId: "wt1" },
    })
  })

  it("resumes deployment after a failed attempt without reimporting the schema", async () => {
    vi.mocked(db.websiteTemplate.findUnique).mockResolvedValue(fakeTemplate as any)
    vi.mocked(db.mcpDeploymentSource.create).mockRejectedValueOnce(new Error("hosting temporarily unavailable"))

    const first = await POST(req(), ctx({ tenant: "acme", id: "wt1" }))
    expect(first.status).toBe(500)
    fakeTenantDb.contentType.findFirst.mockResolvedValue({ id: "imported-ct" })
    const retry = await POST(req(), ctx({ tenant: "acme", id: "wt1" }))
    expect(retry.status).toBe(200)
    expect(materializeSchemaIntoTenant).toHaveBeenCalledTimes(1)
    expect(db.mcpDeploymentSource.create).toHaveBeenCalledTimes(2)
  })

  it("merges the template's resolved env vars into the Environment tab BEFORE deploying", async () => {
    vi.mocked(db.websiteTemplate.findUnique).mockResolvedValue(fakeTemplate as any)
    vi.mocked(resolveWebsiteTemplateEnvVars).mockResolvedValue([{ key: "NEXT_PUBLIC_API_URL", value: "https://sacms.cloud" }])
    vi.mocked(getTenantCustomEnvVarList).mockResolvedValue([{ key: "SOME_EXISTING_VAR", value: "keep-me" }])

    const res = await POST(req(), ctx({ tenant: "acme", id: "wt1" }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(setTenantCustomEnvVars).toHaveBeenCalledWith("tenant1", [
      { key: "SOME_EXISTING_VAR", value: "keep-me" },
      { key: "NEXT_PUBLIC_API_URL", value: "https://sacms.cloud" },
    ])
    expect(body.envVarsApplied).toEqual(["NEXT_PUBLIC_API_URL"])
  })

  it("gives a super_admin no exemption: a Starter workspace stays blocked", async () => {
    mockSession.mockResolvedValue({ user: { id: "user1", role: "super_admin" } } as any)
    vi.mocked(db.websiteTemplate.findUnique).mockResolvedValue(fakeTemplate as any)
    mockAccess.mockResolvedValue({ ...paidAccess, tenant: { ...paidAccess.tenant, plan: "starter" } } as any)

    const res = await POST(req(), ctx({ tenant: "acme", id: "wt1" }))
    expect(res.status).toBe(403)
    expect(materializeSchemaIntoTenant).not.toHaveBeenCalled()
    expect(db.tenant.update).not.toHaveBeenCalled()
  })
})
