import { describe, it, expect, vi, beforeEach } from "vitest"

// deploy-website-template-demo.ts starts with `import "server-only"` —
// not an npm package vitest's plain Node resolution can see, same stub
// used by deploy-frontend-redeploy.test.ts.
vi.mock("server-only", () => ({}))

// deployWebsiteTemplateDemo is what the SaCMS Global MCP server calls on
// every create_website_template / update_website_template(files: ...) —
// it must never throw past the caller (a Vercel hiccup must not fail the
// underlying save), must map WebsiteTemplate's {path,content} file shape
// to what deployToVercel expects ({name,content}), and must persist the
// resulting demo fields on the WebsiteTemplate row.

const websiteTemplateUpdate = vi.fn().mockResolvedValue({})
vi.mock("@/lib/database", () => ({
  db: { websiteTemplate: { update: websiteTemplateUpdate } },
}))

const deployToVercel = vi.fn()
const ensureDemoSubdomain = vi.fn()
const getProjectPrimaryDomain = vi.fn()
vi.mock("@/lib/vercel-client", () => ({
  deployToVercel: (...args: any[]) => deployToVercel(...args),
  ensureDemoSubdomain: (...args: any[]) => ensureDemoSubdomain(...args),
  getProjectPrimaryDomain: (...args: any[]) => getProjectPrimaryDomain(...args),
}))

const resolveWebsiteTemplateEnvVars = vi.fn().mockResolvedValue([])
vi.mock("@/lib/infrastructure/frontend-env", () => ({
  resolveWebsiteTemplateEnvVars: (...args: any[]) => resolveWebsiteTemplateEnvVars(...args),
}))

const ensureDemoTenantForSchemaTemplate = vi.fn()
vi.mock("@/lib/infrastructure/demo-tenant", () => ({
  ensureDemoTenantForSchemaTemplate: (...args: any[]) => ensureDemoTenantForSchemaTemplate(...args),
}))

const { deployWebsiteTemplateDemo } = await import("@/lib/infrastructure/deploy-website-template-demo")

const websiteTemplate = {
  id: "wt_1",
  slug: "modern-dark",
  files: [{ path: "app/page.tsx", content: "export default function Page() {}" }],
  schemaTemplate: { id: "st_1", slug: "company-profile", name: "Company Profile", schema: {}, demoTenantId: null },
}

describe("deployWebsiteTemplateDemo", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ensureDemoTenantForSchemaTemplate.mockResolvedValue({ id: "demo-tenant-1", slug: "demo-company-profile" })
  })

  it("maps {path,content} files to {name,content}, deploys to a dedicated sacms-demo-<slug> project, and persists the result", async () => {
    deployToVercel.mockResolvedValue({ id: "dpl_1", url: "https://sacms-demo-modern-dark.vercel.app", state: "QUEUED", projectId: "prj_1", projectName: "sacms-demo-modern-dark" })
    ensureDemoSubdomain.mockResolvedValue("demo-modern-dark.sites.sacms.cloud")
    getProjectPrimaryDomain.mockResolvedValue("https://demo-modern-dark.sites.sacms.cloud")

    const result = await deployWebsiteTemplateDemo(websiteTemplate)

    expect(deployToVercel).toHaveBeenCalledWith(
      "sacms-demo-modern-dark",
      [{ name: "app/page.tsx", content: "export default function Page() {}" }],
      {},
    )
    expect(ensureDemoSubdomain).toHaveBeenCalledWith("prj_1", "modern-dark")
    expect(result).toEqual({ url: "https://demo-modern-dark.sites.sacms.cloud" })
    expect(websiteTemplateUpdate).toHaveBeenCalledWith({
      where: { id: "wt_1" },
      data: {
        demoVercelProjectId: "prj_1",
        demoUrl: "https://demo-modern-dark.sites.sacms.cloud",
        demoDeployedAt: expect.any(Date),
      },
    })
  })

  it("resolves env vars against the demo tenant, not any real tenant", async () => {
    deployToVercel.mockResolvedValue({ id: "dpl_1", url: "https://x.vercel.app", state: "QUEUED", projectId: "prj_1" })
    getProjectPrimaryDomain.mockResolvedValue("https://x.vercel.app")

    await deployWebsiteTemplateDemo(websiteTemplate)

    expect(resolveWebsiteTemplateEnvVars).toHaveBeenCalledWith("demo-tenant-1", "demo-company-profile", websiteTemplate.files)
  })

  it("never throws — returns a soft error when the demo tenant can't be provisioned", async () => {
    ensureDemoTenantForSchemaTemplate.mockRejectedValue(new Error("db unavailable"))

    const result = await deployWebsiteTemplateDemo(websiteTemplate)

    expect(result).toEqual({ url: null, error: "db unavailable" })
    expect(deployToVercel).not.toHaveBeenCalled()
  })

  it("never throws — returns a soft error when the Vercel deploy itself fails", async () => {
    deployToVercel.mockRejectedValue(new Error("Vercel deployment failed: quota exceeded"))

    const result = await deployWebsiteTemplateDemo(websiteTemplate)

    expect(result).toEqual({ url: null, error: "Vercel deployment failed: quota exceeded" })
    expect(websiteTemplateUpdate).not.toHaveBeenCalled()
  })
})
