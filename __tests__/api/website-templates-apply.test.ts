import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }))
vi.mock("@/lib/auth", () => ({ authOptions: {} }))
vi.mock("@/lib/tenant-access", () => ({ getTenantAccess: vi.fn() }))

const { fakeTenantDb } = vi.hoisted(() => ({
  fakeTenantDb: {
    contentType: { findFirst: vi.fn() },
    singleType: { findFirst: vi.fn() },
    component: { findFirst: vi.fn() },
  },
}))

vi.mock("@/lib/database", () => ({
  db: {
    websiteTemplate: { findUnique: vi.fn() },
    tenant: { update: vi.fn().mockResolvedValue({}) },
  },
  getTenantDb: vi.fn().mockResolvedValue(fakeTenantDb),
}))

vi.mock("@/lib/infrastructure/hosting-plan", () => ({
  isTenantPlanPaid: vi.fn(),
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
import { isTenantPlanPaid } from "@/lib/infrastructure/hosting-plan"
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

  it("blocks a free-plan workspace with a plan_limit error, before touching the workspace schema", async () => {
    vi.mocked(db.websiteTemplate.findUnique).mockResolvedValue(fakeTemplate as any)
    vi.mocked(isTenantPlanPaid).mockReturnValue(false)
    const res = await POST(req(), ctx({ tenant: "acme", id: "wt1" }))
    expect(res.status).toBe(403)
    expect(materializeSchemaIntoTenant).not.toHaveBeenCalled()
    expect(deployTenantFrontend).not.toHaveBeenCalled()
  })

  it("rejects when the workspace already has a Content Type (not empty)", async () => {
    vi.mocked(db.websiteTemplate.findUnique).mockResolvedValue(fakeTemplate as any)
    vi.mocked(isTenantPlanPaid).mockReturnValue(true)
    fakeTenantDb.contentType.findFirst.mockResolvedValue({ id: "ct1" })
    const res = await POST(req(), ctx({ tenant: "acme", id: "wt1" }))
    expect(res.status).toBe(400)
    expect(materializeSchemaIntoTenant).not.toHaveBeenCalled()
    expect(deployTenantFrontend).not.toHaveBeenCalled()
  })

  it("materializes the linked schema and deploys the bundled files on the happy path", async () => {
    vi.mocked(db.websiteTemplate.findUnique).mockResolvedValue(fakeTemplate as any)
    vi.mocked(isTenantPlanPaid).mockReturnValue(true)

    const res = await POST(req(), ctx({ tenant: "acme", id: "wt1" }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(materializeSchemaIntoTenant).toHaveBeenCalledWith(fakeTenantDb, "tenant1", fakeTemplate.schemaTemplate.schema)
    expect(deployTenantFrontend).toHaveBeenCalledWith(
      "tenant1",
      "acme",
      "https://sacms.cloud",
      [{ name: "app/page.tsx", content: "export default function Page() { return null }" }],
    )
    expect(body.imported).toBe(3)
    expect(body.deployment.url).toBe("https://acme.sites.sacms.cloud")
    expect(setTenantCustomEnvVars).not.toHaveBeenCalled()
    expect(body.envVarsApplied).toEqual([])
    expect(db.tenant.update).toHaveBeenCalledWith({
      where: { id: "tenant1" },
      data: { sourceWebsiteTemplateId: "wt1" },
    })
  })

  it("still reports success even if persisting sourceWebsiteTemplateId fails — informational only, never gates the apply", async () => {
    vi.mocked(db.websiteTemplate.findUnique).mockResolvedValue(fakeTemplate as any)
    vi.mocked(isTenantPlanPaid).mockReturnValue(true)
    vi.mocked(db.tenant.update).mockRejectedValueOnce(new Error("db hiccup"))

    const res = await POST(req(), ctx({ tenant: "acme", id: "wt1" }))
    expect(res.status).toBe(200)
  })

  it("merges the template's resolved env vars into the Environment tab BEFORE deploying", async () => {
    vi.mocked(db.websiteTemplate.findUnique).mockResolvedValue(fakeTemplate as any)
    vi.mocked(isTenantPlanPaid).mockReturnValue(true)
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

  it("lets a super_admin apply even on a free plan", async () => {
    mockSession.mockResolvedValue({ user: { id: "user1", role: "super_admin" } } as any)
    vi.mocked(db.websiteTemplate.findUnique).mockResolvedValue(fakeTemplate as any)
    vi.mocked(isTenantPlanPaid).mockReturnValue(false)

    const res = await POST(req(), ctx({ tenant: "acme", id: "wt1" }))
    expect(res.status).toBe(200)
    expect(materializeSchemaIntoTenant).toHaveBeenCalled()
    expect(db.tenant.update).toHaveBeenCalledWith({
      where: { id: "tenant1" },
      data: { sourceWebsiteTemplateId: "wt1" },
    })
  })
})
