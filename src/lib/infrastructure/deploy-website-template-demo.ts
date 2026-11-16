import "server-only"

import { db } from "@/lib/database"
import { deployToVercel, ensureDemoSubdomain, getProjectPrimaryDomain } from "@/lib/vercel-client"
import { resolveWebsiteTemplateEnvVars, resolveFrontendEnv, resolveApiOrigin } from "./frontend-env"
import { ensureDemoTenantForSchemaTemplate } from "./demo-tenant"

export interface WebsiteTemplateDemoInput {
  id: string
  slug: string
  files: { path: string; content: string }[]
  schemaTemplate: {
    id: string
    slug: string
    name: string
    schema: unknown
    demoTenantId: string | null
  }
}

export interface DeployWebsiteTemplateDemoResult {
  url: string | null
  deploymentId?: string
  /** Did a quick HTTP fetch of `url` actually succeed and look like a real
   *  page? Only meaningful when `url` is non-null — chatgpt.md/chatgpt1.md's
   *  core "don't report done just because the provider accepted the
   *  request" finding applies just as much to a template preview as it
   *  does to a real tenant deploy: Vercel ACCEPTING the build is not the
   *  same as the demo actually rendering anything. */
  verified?: boolean
  verificationError?: string
  error?: string
}

/** Heuristic error-page detector shared conceptually with the per-workspace
 *  MCP server's verify_deployment_url — catches Vercel's own protection/
 *  not-found boilerplate, not every possible broken state. */
const LOOKS_LIKE_ERROR_PAGE_RE = /DEPLOYMENT_NOT_FOUND|This deployment is protected|Authentication Required/i

/** Exported for get_website_template_demo_status — a fresh, on-demand
 *  check of a demo's CURRENT state, independent of redeploying it. */
export async function verifyDemoUrl(url: string): Promise<{ verified: boolean; error?: string }> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 10000)
  try {
    const res = await fetch(url, { method: "GET", signal: controller.signal, headers: { "User-Agent": "SaCMS-Template-Demo-Verify/1.0" } })
    const html = await res.text().catch(() => "")
    if (!res.ok) return { verified: false, error: `HTTP ${res.status}` }
    if (LOOKS_LIKE_ERROR_PAGE_RE.test(html)) return { verified: false, error: "Response looks like a deployment error/protection page, not the actual site." }
    return { verified: true }
  } catch (err: any) {
    return { verified: false, error: err?.message || "Fetch failed" }
  } finally {
    clearTimeout(timeoutId)
  }
}

/**
 * Deploys a WebsiteTemplate's bundled files to its own demo Vercel project
 * (`sacms-demo-<slug>`), live at `https://demo-<slug>.sites.sacms.cloud` —
 * the same `sites.sacms.cloud` root real tenant deployments use (a
 * standalone `demo.sacms.cloud` root was tried first but its wildcard
 * domain was never fully live on Vercel's side, so every URL under it
 * failed TLS) — fed by a dedicated internal demo tenant seeded with sample
 * content (see demo-tenant.ts), never a real customer's data. Called
 * automatically from the SaCMS Global MCP server on every
 * create/update-with-files so the team can test in a real browser until
 * it's right.
 *
 * Never throws — a demo-deploy failure (Vercel hiccup, DNS not live yet)
 * must never fail the underlying create/update of the template itself.
 * The URL verification step is also best-effort: its result is reported
 * back, never thrown, so a slow/offline check doesn't fail the save either.
 */
export async function deployWebsiteTemplateDemo(
  websiteTemplate: WebsiteTemplateDemoInput,
): Promise<DeployWebsiteTemplateDemoResult> {
  try {
    const demoTenant = await ensureDemoTenantForSchemaTemplate(websiteTemplate.schemaTemplate)

    const files = websiteTemplate.files.map((f) => ({ name: f.path, content: f.content }))

    // chatgpt8.md P0: this used to call ONLY resolveWebsiteTemplateEnvVars,
    // which deliberately EXCLUDES the three fixed SYSTEM_ENV_VARS names
    // (NEXT_PUBLIC_SACMS_API_URL/_TENANT/SACMS_API_KEY — see its own
    // RESERVED_ENV_KEYS guard) on the assumption that something else injects
    // them, the way deployTenantFrontend's resolveFrontendEnv call always
    // does for a REAL tenant deploy. Nothing played that role here, so a
    // demo's frontend had no way to reach the CMS at all unless its own
    // .env.example happened to use different, non-canonical var names with a
    // {{SACMS_*}} placeholder — confirmed live: articles/Single
    // Types/components never rendered, only ever the sample-data-free shell.
    // resolveFrontendEnv supplies the three system vars (always win) plus
    // whatever custom vars the demo tenant itself has (normally none);
    // resolveWebsiteTemplateEnvVars is still needed on top for a template
    // that reads a DIFFERENT custom name via a {{SACMS_*}} placeholder.
    const [systemEnv, resolvedEnvVars] = await Promise.all([
      resolveFrontendEnv(demoTenant.id, demoTenant.slug, resolveApiOrigin()),
      resolveWebsiteTemplateEnvVars(demoTenant.id, demoTenant.slug, websiteTemplate.files),
    ])
    const envVars = {
      ...systemEnv,
      ...Object.fromEntries(resolvedEnvVars.map((v) => [v.key, v.value])),
    }

    const projectName = `sacms-demo-${websiteTemplate.slug}`
    // Explicit "production" — this demo preview is meant to be immediately
    // viewable at its own live URL (that's the whole point of a preview),
    // unlike the MCP deploy tools' new staged-by-default behavior.
    const deployResult = await deployToVercel(projectName, files, envVars, undefined, "production")

    if (deployResult.projectId) {
      await ensureDemoSubdomain(deployResult.projectId, websiteTemplate.slug)
    }
    const url = (deployResult.projectId ? await getProjectPrimaryDomain(deployResult.projectId) : null) || deployResult.url || null

    await db.websiteTemplate.update({
      where: { id: websiteTemplate.id },
      data: {
        demoVercelProjectId: deployResult.projectId || undefined,
        demoUrl: url,
        demoDeployedAt: new Date(),
        demoDeploymentId: deployResult.id || undefined,
      },
    })

    if (!url) {
      return { url: null, deploymentId: deployResult.id, verified: false, verificationError: "No URL resolved for the demo deployment." }
    }
    // chatgpt8.md P1: a fresh custom-domain alias (ensureDemoSubdomain just
    // ran above) can take a few seconds to actually start routing — the
    // very first check right after a create/update used to come back
    // ECONNRESET even though the SAME url, checked moments later by hand,
    // was already a plain HTTP 200. 3 short, limited retries covers that
    // cutover window without turning this into an open-ended poll — this is
    // still a single deploy call's own verification step, not a background
    // job, so it can't wait indefinitely.
    let verification = await verifyDemoUrl(url)
    for (let attempt = 0; !verification.verified && attempt < 2; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 2500))
      verification = await verifyDemoUrl(url)
    }
    return { url, deploymentId: deployResult.id, verified: verification.verified, verificationError: verification.error }
  } catch (err: any) {
    console.warn(`[deploy-website-template-demo] Failed to deploy demo for ${websiteTemplate.slug}:`, err)
    return { url: null, error: err?.message || "Gagal men-deploy demo" }
  }
}
