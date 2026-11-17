import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

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
// Reset to an immediately-terminal READY build in beforeEach below, so
// every existing test (written before chatgpt.md's build-status poll
// existed) keeps passing with no extra delay — only the tests that
// specifically exercise the build-failure/pending path override this.
const getDeploymentStatus = vi.fn()
const getDeploymentBuildLogs = vi.fn()
vi.mock("@/lib/vercel-client", () => ({
  deployToVercel: (...args: any[]) => deployToVercel(...args),
  ensureDemoSubdomain: (...args: any[]) => ensureDemoSubdomain(...args),
  getProjectPrimaryDomain: (...args: any[]) => getProjectPrimaryDomain(...args),
  getDeploymentStatus: (...args: any[]) => getDeploymentStatus(...args),
  getDeploymentBuildLogs: (...args: any[]) => getDeploymentBuildLogs(...args),
}))

const resolveWebsiteTemplateEnvVars = vi.fn().mockResolvedValue([])
const resolveFrontendEnv = vi.fn().mockResolvedValue({
  NEXT_PUBLIC_SACMS_API_URL: "https://sacms.cloud",
  NEXT_PUBLIC_SACMS_TENANT: "demo-company-profile",
  SACMS_API_KEY: "sacms_live_demo_token",
})
const resolveApiOrigin = vi.fn().mockReturnValue("https://sacms.cloud")
vi.mock("@/lib/infrastructure/frontend-env", () => ({
  resolveWebsiteTemplateEnvVars: (...args: any[]) => resolveWebsiteTemplateEnvVars(...args),
  resolveFrontendEnv: (...args: any[]) => resolveFrontendEnv(...args),
  resolveApiOrigin: (...args: any[]) => resolveApiOrigin(...args),
}))

const ensureDemoTenantForSchemaTemplate = vi.fn()
vi.mock("@/lib/infrastructure/demo-tenant", () => ({
  ensureDemoTenantForSchemaTemplate: (...args: any[]) => ensureDemoTenantForSchemaTemplate(...args),
}))

const { deployWebsiteTemplateDemo, verifyDemoRoutes } = await import("@/lib/infrastructure/deploy-website-template-demo")

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
    // Re-applied every test (not just once at module scope) — clearAllMocks
    // keeps whatever implementation a PRIOR test last set via a plain
    // (non-Once) mockResolvedValue, so a test that overrides this to
    // simulate a stuck build would otherwise leak that into every test
    // that runs after it in the file.
    getDeploymentStatus.mockResolvedValue({ state: "READY", deploymentUrl: "", productionUrl: null })
    getDeploymentBuildLogs.mockResolvedValue({ lines: [], errorLines: [] })
  })

  const originalFetch = global.fetch

  afterEach(() => {
    global.fetch = originalFetch
  })

  it("maps {path,content} files to {name,content}, deploys to a dedicated sacms-demo-<slug> project, persists the result, and verifies the URL actually renders", async () => {
    deployToVercel.mockResolvedValue({ id: "dpl_1", url: "https://sacms-demo-modern-dark.vercel.app", state: "QUEUED", projectId: "prj_1", projectName: "sacms-demo-modern-dark" })
    ensureDemoSubdomain.mockResolvedValue("demo-modern-dark.sites.sacms.cloud")
    getProjectPrimaryDomain.mockResolvedValue("https://demo-modern-dark.sites.sacms.cloud")
    global.fetch = vi.fn().mockResolvedValue({ ok: true, text: async () => "<html>real page</html>" }) as any

    const result = await deployWebsiteTemplateDemo(websiteTemplate)

    expect(deployToVercel).toHaveBeenCalledWith(
      "sacms-demo-modern-dark",
      [{ name: "app/page.tsx", content: "export default function Page() {}" }],
      {
        NEXT_PUBLIC_SACMS_API_URL: "https://sacms.cloud",
        NEXT_PUBLIC_SACMS_TENANT: "demo-company-profile",
        SACMS_API_KEY: "sacms_live_demo_token",
      },
      undefined,
      "production",
    )
    expect(ensureDemoSubdomain).toHaveBeenCalledWith("prj_1", "modern-dark")
    expect(result).toEqual({
      url: "https://demo-modern-dark.sites.sacms.cloud",
      deploymentId: "dpl_1",
      verified: true,
      verificationError: undefined,
      routes: [{ path: "/", verified: true, error: undefined }],
    })
    expect(websiteTemplateUpdate).toHaveBeenCalledWith({
      where: { id: "wt_1" },
      data: {
        demoVercelProjectId: "prj_1",
        demoUrl: "https://demo-modern-dark.sites.sacms.cloud",
        demoDeployedAt: expect.any(Date),
        demoDeploymentId: "dpl_1",
      },
    })
  })

  it("reports verified: false (never throws) when Vercel accepted the deploy but the URL doesn't actually render — accepted is not the same as working, even after retrying through the alias-cutover window", async () => {
    deployToVercel.mockResolvedValue({ id: "dpl_1", url: "https://x.vercel.app", state: "QUEUED", projectId: "prj_1" })
    getProjectPrimaryDomain.mockResolvedValue("https://demo-x.sites.sacms.cloud")
    global.fetch = vi.fn().mockResolvedValue({ ok: true, text: async () => "DEPLOYMENT_NOT_FOUND" }) as any

    vi.useFakeTimers()
    const pending = deployWebsiteTemplateDemo(websiteTemplate)
    // 2 retries at 2.5s each — advance past both without a real wall-clock wait.
    await vi.advanceTimersByTimeAsync(2500)
    await vi.advanceTimersByTimeAsync(2500)
    const result = await pending
    vi.useRealTimers()

    expect(result.verified).toBe(false)
    expect(result.verificationError).toMatch(/error\/protection page/)
    // 3 homepage attempts (initial + 2 retries through the alias-cutover
    // window) + 1 sitemap.xml probe (verifyDemoRoutes always attempts
    // this, regardless of whether the homepage itself verified).
    expect(global.fetch).toHaveBeenCalledTimes(4)
  })

  // chatgpt.md P0: the demo deploy used to check ONLY the alias URL, never
  // the build this call itself just triggered — a build Vercel reports
  // ERROR never gets promoted onto the alias, so the alias kept serving the
  // PREVIOUS successful deployment and the URL check came back healthy,
  // reporting verified: true for a build that had actually failed.
  it("reports a FAILED build as verified:false immediately, without ever checking the (possibly stale) alias URL", async () => {
    deployToVercel.mockResolvedValue({ id: "dpl_1", url: "https://x.vercel.app", state: "BUILDING", projectId: "prj_1" })
    getProjectPrimaryDomain.mockResolvedValue("https://demo-x.sites.sacms.cloud")
    getDeploymentStatus.mockResolvedValueOnce({ state: "ERROR", deploymentUrl: "", productionUrl: null })
    getDeploymentBuildLogs.mockResolvedValueOnce({ lines: ["Build started", "Error: Unexpected token"], errorLines: ["Error: Unexpected token"] })
    global.fetch = vi.fn().mockResolvedValue({ ok: true, text: async () => "<html>still the old good deploy</html>" }) as any

    const result = await deployWebsiteTemplateDemo(websiteTemplate)

    expect(result.verified).toBe(false)
    expect(result.error).toMatch(/Build ERROR.*Unexpected token/)
    expect(result.verificationError).toMatch(/PREVIOUS successful deployment/)
    expect(global.fetch).not.toHaveBeenCalled()
  })

  // chatgpt.md P0, same root cause: a build still mid-flight past the poll
  // budget must not be reported verified just because the URL happens to
  // respond right now — it may still be answering for the PREVIOUS build.
  it("treats a build still BUILDING after the poll budget as inconclusive, not verified", async () => {
    deployToVercel.mockResolvedValue({ id: "dpl_1", url: "https://x.vercel.app", state: "BUILDING", projectId: "prj_1" })
    getProjectPrimaryDomain.mockResolvedValue("https://demo-x.sites.sacms.cloud")
    getDeploymentStatus.mockResolvedValue({ state: "BUILDING", deploymentUrl: "", productionUrl: null })
    global.fetch = vi.fn().mockResolvedValue({ ok: true, text: async () => "<html>maybe the old deploy</html>" }) as any

    vi.useFakeTimers()
    const pending = deployWebsiteTemplateDemo(websiteTemplate)
    await vi.advanceTimersByTimeAsync(3000 * 15) // the full build-poll budget, never reaching a terminal state
    const result = await pending
    vi.useRealTimers()

    expect(result.verified).toBe(false)
    expect(result.verificationError).toMatch(/still BUILDING after the verification window/)
  })

  it("resolves env vars against the demo tenant, not any real tenant", async () => {
    deployToVercel.mockResolvedValue({ id: "dpl_1", url: "https://x.vercel.app", state: "QUEUED", projectId: "prj_1" })
    getProjectPrimaryDomain.mockResolvedValue("https://x.vercel.app")
    global.fetch = vi.fn().mockResolvedValue({ ok: true, text: async () => "<html></html>" }) as any

    await deployWebsiteTemplateDemo(websiteTemplate)

    expect(resolveWebsiteTemplateEnvVars).toHaveBeenCalledWith("demo-tenant-1", "demo-company-profile", websiteTemplate.files)
  })

  // chatgpt8.md P0: the demo deploy used to call ONLY
  // resolveWebsiteTemplateEnvVars, which deliberately excludes the three
  // fixed SACMS_* names — so a deployed demo had no way to reach the CMS at
  // all (confirmed live: articles/Single Types/components never rendered).
  it("injects the fixed NEXT_PUBLIC_SACMS_API_URL/_TENANT/SACMS_API_KEY system vars via resolveFrontendEnv, so the demo can actually reach the CMS", async () => {
    deployToVercel.mockResolvedValue({ id: "dpl_1", url: "https://x.vercel.app", state: "QUEUED", projectId: "prj_1" })
    getProjectPrimaryDomain.mockResolvedValue("https://x.vercel.app")
    global.fetch = vi.fn().mockResolvedValue({ ok: true, text: async () => "<html></html>" }) as any

    await deployWebsiteTemplateDemo(websiteTemplate)

    expect(resolveFrontendEnv).toHaveBeenCalledWith("demo-tenant-1", "demo-company-profile", "https://sacms.cloud")
    expect(deployToVercel).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Array),
      expect.objectContaining({
        NEXT_PUBLIC_SACMS_API_URL: "https://sacms.cloud",
        NEXT_PUBLIC_SACMS_TENANT: "demo-company-profile",
        SACMS_API_KEY: "sacms_live_demo_token",
      }),
      undefined,
      "production",
    )
  })

  it("lets a template-specific {{SACMS_*}} placeholder (a custom var name) override the system vars on top", async () => {
    deployToVercel.mockResolvedValue({ id: "dpl_1", url: "https://x.vercel.app", state: "QUEUED", projectId: "prj_1" })
    getProjectPrimaryDomain.mockResolvedValue("https://x.vercel.app")
    global.fetch = vi.fn().mockResolvedValue({ ok: true, text: async () => "<html></html>" }) as any
    resolveWebsiteTemplateEnvVars.mockResolvedValueOnce([{ key: "NEXT_PUBLIC_API_URL", value: "https://sacms.cloud" }])

    await deployWebsiteTemplateDemo(websiteTemplate)

    expect(deployToVercel).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Array),
      expect.objectContaining({
        NEXT_PUBLIC_SACMS_API_URL: "https://sacms.cloud",
        NEXT_PUBLIC_API_URL: "https://sacms.cloud",
      }),
      undefined,
      "production",
    )
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

// Kabar Nusa report P0: the old single-URL check only ever looked at "/" —
// a demo whose every list/detail route 500'd still reported verified: true
// as long as the homepage rendered. verifyDemoRoutes reads the demo's own
// sitemap.xml (if it has one) and checks every route it lists too.
describe("verifyDemoRoutes", () => {
  const originalFetch = global.fetch
  afterEach(() => {
    global.fetch = originalFetch
  })

  it("checks every route a real sitemap.xml lists, and fails overall if even one of them 500s", async () => {
    global.fetch = vi.fn(async (url: string) => {
      if (url.endsWith("/sitemap.xml")) {
        return {
          ok: true,
          text: async () => `<?xml version="1.0"?><urlset>
            <url><loc>https://demo.sites.sacms.cloud/</loc></url>
            <url><loc>https://demo.sites.sacms.cloud/berita/artikel-1</loc></url>
            <url><loc>https://demo.sites.sacms.cloud/berita/artikel-2</loc></url>
          </urlset>`,
        }
      }
      if (url.endsWith("/berita/artikel-2")) {
        return { ok: false, status: 500, text: async () => "" }
      }
      return { ok: true, text: async () => "<html>real page</html>" }
    }) as any

    const result = await verifyDemoRoutes("https://demo.sites.sacms.cloud")

    expect(result.verified).toBe(false)
    expect(result.routes).toEqual([
      { path: "/", verified: true, error: undefined },
      { path: "/berita/artikel-1", verified: true, error: undefined },
      { path: "/berita/artikel-2", verified: false, error: "HTTP 500" },
    ])
  })

  it("falls back to just the homepage when there's no sitemap.xml (or it fails to fetch)", async () => {
    global.fetch = vi.fn(async (url: string) => {
      if (url.endsWith("/sitemap.xml")) return { ok: false, status: 404, text: async () => "" }
      return { ok: true, text: async () => "<html>real page</html>" }
    }) as any

    const result = await verifyDemoRoutes("https://demo.sites.sacms.cloud")

    expect(result.verified).toBe(true)
    expect(result.routes).toEqual([{ path: "/", verified: true, error: undefined }])
  })
})
