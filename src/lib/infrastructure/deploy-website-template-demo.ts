import "server-only"

import { db } from "@/lib/database"
import { randomBytes, createHash } from "crypto"
import { deployToVercel, ensureDemoSubdomain, getProjectPrimaryDomain, getDeploymentStatus, getDeploymentBuildLogs, getRuntimeLogs, deleteVercelProject, disableVercelDeploymentProtection } from "@/lib/vercel-client"
import { resolveWebsiteTemplateEnvVars, resolveFrontendEnv, resolveApiOrigin } from "./frontend-env"
import { ensureDemoTenantForSchemaTemplate } from "./demo-tenant"
import { ensurePublicSubdomainToken } from "./public-subdomain"

export interface WebsiteTemplateDemoInput {
  id: string
  slug: string
  files: { path: string; content: string; encoding?: "utf-8" | "base64" }[]
  seedMissingContent?: boolean
  schemaTemplate: {
    id: string
    slug: string
    name: string
    schema: unknown
    demoTenantId: string | null
  }
}

export interface RouteCheckResult {
  path: string
  verified: boolean
  error?: string
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
  /** Kabar Nusa report P0: `verified` used to reflect ONLY the homepage —
   *  a demo whose every list/detail route 500'd still reported verified:
   *  true as long as "/" rendered. Per-route breakdown (homepage plus up
   *  to MAX_SITEMAP_ROUTES_CHECKED real routes read from the demo's own
   *  sitemap.xml, if it has one) so a caller can see exactly which route
   *  failed instead of just an aggregate boolean. */
  routes?: RouteCheckResult[]
  error?: string
}

/** Heuristic error-page detector shared conceptually with the per-workspace
 *  MCP server's verify_deployment_url — catches Vercel's own protection/
 *  not-found boilerplate, not every possible broken state. */
const LOOKS_LIKE_ERROR_PAGE_RE = /DEPLOYMENT_NOT_FOUND|This deployment is protected|Authentication Required/i

const TERMINAL_BUILD_STATE_RE = /^(READY|ERROR|CANCELED)$/i
const BUILD_POLL_INTERVAL_MS = 3000
// ~45s budget — a real Next.js build on Vercel routinely takes longer than
// the few seconds the URL-verification retry loop below allows, which used
// to let this function check the ALIAS before the just-triggered build had
// even finished: if the alias still served the PREVIOUS successful
// deployment (Vercel never promotes a failed build onto it), that stale
// content read back fine and got reported `verified: true` even though the
// build chatgpt.md deliberately broke was failing with Turbopack errors at
// that exact moment (confirmed live). Bounded, not an open-ended poll — this
// is still one deploy call's own verification step.
const BUILD_POLL_MAX_ATTEMPTS = 15

/** Polls the deployment's OWN build state (not the project's alias/URL)
 *  until it reaches a terminal state or the bounded budget runs out.
 *  Checks before sleeping, so a mock/simulated deploy that's already
 *  terminal resolves instantly with no delay. */
async function waitForBuildTerminal(deploymentId: string, maxAttempts = BUILD_POLL_MAX_ATTEMPTS): Promise<string> {
  let state = ""
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const status = await getDeploymentStatus(deploymentId).catch(() => null)
    state = status?.state || state
    if (state && TERMINAL_BUILD_STATE_RE.test(state)) return state
    await new Promise((resolve) => setTimeout(resolve, BUILD_POLL_INTERVAL_MS))
  }
  return state || "UNKNOWN"
}

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

const MAX_SITEMAP_ROUTES_CHECKED = 5

/** Extracts up to `limit` distinct, non-root paths from a sitemap.xml
 *  body's <loc> entries — a tiny regex extractor rather than a full XML
 *  parser dependency, consistent with this file's existing
 *  LOOKS_LIKE_ERROR_PAGE_RE heuristic-over-dependency style. Only the
 *  PATH is kept (not the full <loc> URL) so each one is checked against
 *  THIS demo's actual serving domain, not whatever host the sitemap
 *  itself happened to hardcode. */
function extractSitemapPaths(xml: string, limit: number): string[] {
  const locs = Array.from(xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)).map((m) => m[1])
  const paths: string[] = []
  for (const loc of locs) {
    try {
      const path = new URL(loc).pathname
      if (path && path !== "/" && !paths.includes(path)) paths.push(path)
    } catch {
      // Not a full URL (a relative <loc>, or malformed) — skip it rather
      // than guessing at a base to resolve it against.
    }
    if (paths.length >= limit) break
  }
  return paths
}

/** SHA256 hash of verified routes — for drift detection when demo domain
 *  changes. Hashes the JSON-serialized array of route results (path, verified,
 *  error), so a domain change producing different routing results will hash
 *  differently. Used by audit tooling to detect when demoUrl metadata no
 *  longer matches actual routing. */
function hashRouteCheckResults(routes: RouteCheckResult[]): string {
  const data = JSON.stringify(routes, null, 0)
  return createHash("sha256").update(data).digest("hex")
}

/**
 * Checks the homepage AND, when the demo has a sitemap.xml, up to
 * MAX_SITEMAP_ROUTES_CHECKED more real routes read from it — the Kabar
 * Nusa report's core P0 finding: the previous single-URL check only ever
 * looked at "/", so a demo whose every list/detail route 500'd still
 * reported `verified: true` as long as the homepage rendered. Never
 * throws — a route this can't check (network error, non-200 response, or
 * a response that looks like Vercel's own error/protection page) is
 * reported as a failed check for THAT route, not a thrown error.
 */
export async function verifyDemoRoutes(
  baseUrl: string,
  opts: {
    /** chatgpt8.md P1: a fresh custom-domain alias can take a few seconds
     *  to actually start routing right after deploy — only worth the
     *  retry cost right after a deploy, not on an on-demand status check
     *  of an already-settled domain. */
    retryHomepage?: boolean
  } = {},
): Promise<{ verified: boolean; routes: RouteCheckResult[] }> {
  const origin = baseUrl.replace(/\/+$/, "")
  const routes: RouteCheckResult[] = []

  let home = await verifyDemoUrl(origin)
  if (opts.retryHomepage) {
    for (let attempt = 0; !home.verified && attempt < 2; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 2500))
      home = await verifyDemoUrl(origin)
    }
  }
  routes.push({ path: "/", verified: home.verified, error: home.error })

  const extraPaths = await fetch(`${origin}/sitemap.xml`, { signal: AbortSignal.timeout(8000) })
    .then((res) => (res.ok ? res.text() : ""))
    .then((xml) => (xml ? extractSitemapPaths(xml, MAX_SITEMAP_ROUTES_CHECKED) : []))
    .catch(() => [] as string[])

  for (const path of extraPaths) {
    const result = await verifyDemoUrl(`${origin}${path}`)
    routes.push({ path, verified: result.verified, error: result.error })
  }

  return { verified: routes.every((r) => r.verified), routes }
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
    const demoTenant = await ensureDemoTenantForSchemaTemplate(websiteTemplate.schemaTemplate, {
      seedMissingContent: websiteTemplate.seedMissingContent,
    })

    // encoding carries binary assets (logo/fonts) through as real bytes.
    const files = websiteTemplate.files.map((f) => ({ name: f.path, content: f.content, encoding: f.encoding }))

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
      // A long templateSlug (e.g. "profil-dinas-pemberdayaan-perempuan-...")
      // made `demo-<templateSlug>.sites.sacms.cloud` exceed the SSL
      // certificate issuer's 64-character Common Name limit outright
      // ("The common name is longer than 64 characters"), failing cert
      // issuance for the whole domain. Self-heals EVERY demo tenant (not
      // just new ones) onto a short random token instead — unlike a real
      // customer tenant, a demo has no external bookmarks/SEO to break, and
      // one stuck on the old slug-based domain is already non-functional
      // today from this exact failure, so backfilling only fixes it.
      const subdomainToken = await ensurePublicSubdomainToken(demoTenant.id).catch(() => websiteTemplate.slug)
      await ensureDemoSubdomain(deployResult.projectId, subdomainToken)
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

    // chatgpt.md P0: check the build this call just triggered BEFORE trusting
    // the alias/URL check below — the alias can keep serving a PREVIOUS
    // successful deployment while THIS build is still running or has
    // outright failed, and Vercel never promotes a failed build onto it, so
    // a URL-only check can look perfectly healthy while the change just made
    // never shipped at all.
    const buildState = deployResult.id ? await waitForBuildTerminal(deployResult.id) : deployResult.state

    if (/^(ERROR|CANCELED)$/i.test(buildState)) {
      const logs = deployResult.id ? await getDeploymentBuildLogs(deployResult.id).catch(() => null) : null
      const buildErrorSummary = logs?.errorLines?.slice(-5).join(" | ")
      const detail = `Build ${buildState}${buildErrorSummary ? `: ${buildErrorSummary}` : ""}`
      return {
        url,
        deploymentId: deployResult.id,
        verified: false,
        verificationError: `${detail}. The URL above (if reachable) is still serving a PREVIOUS successful deployment, not this one.`,
        error: detail,
      }
    }

    // Kabar Nusa report P0: this used to stop at the homepage — a demo
    // whose every list/detail route 500'd still reported `verified: true`
    // as long as "/" rendered. Check every route the demo's own
    // sitemap.xml advertises too, not just the one that's always checked.
    // retryHomepage: true covers the brief window right after
    // ensureDemoSubdomain where a fresh custom-domain alias hasn't started
    // routing yet (confirmed live: the very first check right after a
    // create/update used to come back ECONNRESET even though the SAME url,
    // checked moments later by hand, was already a plain HTTP 200).
    const { verified: routesVerified, routes } = await verifyDemoRoutes(url, { retryHomepage: true })

    // Store a hash of the verified routes for drift detection — if the demo
    // domain changes (old → new), routes at the new domain will hash
    // differently, so audit tooling can detect when demoUrl metadata no
    // longer matches actual routing.
    const routesHash = hashRouteCheckResults(routes)
    await db.websiteTemplate.update({
      where: { id: websiteTemplate.id },
      data: { demoRoutesHash: routesHash },
    }).catch((err) => console.warn(`[deploy-website-template-demo] Failed to save routes hash:`, err))

    // The build poll above has its own bounded budget — if it ran out
    // while the build was still BUILDING/QUEUED/INITIALIZING (never
    // reached a terminal state), the route checks just performed may still
    // be reading a previous deployment. Don't report `verified: true` on an
    // inconclusive build state.
    const buildStillPending = buildState !== "" && !/^READY$/i.test(buildState)
    const failedRoute = routes.find((r) => !r.verified)
    return {
      url,
      deploymentId: deployResult.id,
      verified: routesVerified && !buildStillPending,
      routes,
      verificationError: buildStillPending
        ? `Build still ${buildState} after the verification window — this check may reflect a previous deployment, not the one just triggered. Call get_website_template_demo_status shortly to confirm.`
        : failedRoute
          ? `Route ${failedRoute.path} failed: ${failedRoute.error || "unknown error"}`
          : undefined,
    }
  } catch (err: any) {
    console.warn(`[deploy-website-template-demo] Failed to deploy demo for ${websiteTemplate.slug}:`, err)
    return { url: null, error: err?.message || "Gagal men-deploy demo" }
  }
}

export interface BundleBuildVerification {
  /** passed = built AND every checked route rendered; skipped = no Vercel
   *  token (local dev), nothing was built. */
  status: "passed" | "build_failed" | "runtime_failed" | "timeout" | "skipped" | "error"
  buildState?: string
  routes?: RouteCheckResult[]
  buildErrorLines?: string[]
  runtimeErrorLines?: string[]
  /** "demo" = built against the template's real demo workspace data;
   *  "placeholder" = no demo workspace exists yet, so a page that fetches
   *  content at build/request time may legitimately render empty or fail. */
  envSource: "demo" | "placeholder"
  message: string
}

/** ~3 minutes — this always runs as a background operation, so it can
 *  afford a real Next.js build instead of the demo deploy's ~45s budget. */
const SANDBOX_BUILD_POLL_ATTEMPTS = 60

/**
 * A dryRun's REAL build check (audit VAL-17: dryRun only validated shape,
 * so a bundle that failed `next build` — or built but 500'd at runtime,
 * like the Turbopack-externalized sanitize-html/jsdom case — still passed).
 *
 * Builds on Vercel's own isolated build infrastructure in a throwaway
 * project, never on SaCMS's servers: running `next build` here would mean
 * executing arbitrary bundle code (next.config, postcss, install scripts)
 * on the production host. The project is deleted afterwards whatever the
 * outcome, so nothing is persisted and no template/demo is touched.
 */
export async function verifyBundleBuild(
  files: { path: string; content: string; encoding?: "utf-8" | "base64" }[],
  demoTenant: { id: string; slug: string } | null,
): Promise<BundleBuildVerification> {
  const envSource = demoTenant ? "demo" : "placeholder"
  let projectId: string | undefined
  try {
    const envVars = demoTenant
      ? {
          ...(await resolveFrontendEnv(demoTenant.id, demoTenant.slug, resolveApiOrigin())),
          ...Object.fromEntries((await resolveWebsiteTemplateEnvVars(demoTenant.id, demoTenant.slug, files)).map((v) => [v.key, v.value])),
        }
      : { NEXT_PUBLIC_SACMS_API_URL: resolveApiOrigin(), NEXT_PUBLIC_SACMS_TENANT: "sacms-dryrun" }

    const projectName = `sacms-dryrun-${randomBytes(5).toString("hex")}`
    const deploy = await deployToVercel(
      projectName,
      files.map((f) => ({ name: f.path, content: f.content, encoding: f.encoding })),
      envVars,
      undefined,
      "production",
    )
    projectId = deploy.projectId
    if (deploy.simulated) {
      return { status: "skipped", envSource, message: "Vercel is not configured in this environment — no real build was run." }
    }

    const buildState = deploy.id ? await waitForBuildTerminal(deploy.id, SANDBOX_BUILD_POLL_ATTEMPTS) : deploy.state
    if (/^(ERROR|CANCELED)$/i.test(buildState)) {
      const logs = deploy.id ? await getDeploymentBuildLogs(deploy.id).catch(() => null) : null
      return { status: "build_failed", buildState, buildErrorLines: logs?.errorLines?.slice(-20), envSource, message: `The bundle failed to build (${buildState}). Fix buildErrorLines before saving.` }
    }
    if (!/^READY$/i.test(buildState)) {
      return { status: "timeout", buildState, envSource, message: `The build didn't finish within the sandbox budget (last state: ${buildState || "unknown"}).` }
    }

    // Throwaway project, deleted below — lifting protection only so the
    // render check reads the real page instead of Vercel's login wall.
    if (projectId) await disableVercelDeploymentProtection(projectId).catch(() => null)
    const url = (projectId ? await getProjectPrimaryDomain(projectId).catch(() => null) : null) || deploy.url
    const verification = await verifyDemoRoutes(url, { retryHomepage: true })

    let runtimeErrorLines: string[] | undefined
    if (!verification.verified && projectId && deploy.id) {
      const runtime = await getRuntimeLogs(projectId, deploy.id).catch(() => null)
      if (runtime?.errorLines.length) {
        runtimeErrorLines = runtime.errorLines.slice(-20).map((l) => `[${l.responseStatusCode ?? "?"}] ${l.requestPath ?? ""} ${l.message}`.trim())
      }
    }

    return verification.verified
      ? { status: "passed", buildState, routes: verification.routes, envSource, message: "The bundle built and every checked route rendered." }
      : {
          status: "runtime_failed",
          buildState,
          routes: verification.routes,
          runtimeErrorLines,
          envSource,
          message: envSource === "placeholder"
            ? "The bundle built, but a route failed to render. With no demo workspace yet, a page that requires CMS data can fail here legitimately — check runtimeErrorLines."
            : "The bundle built, but a route failed to render at request time — check runtimeErrorLines (e.g. a package the bundler left external that isn't available at runtime).",
        }
  } catch (err: any) {
    return { status: "error", envSource, message: err?.message || "Sandbox build failed to start." }
  } finally {
    if (projectId) await deleteVercelProject(projectId).catch((e) => console.warn(`[verifyBundleBuild] Failed to delete sandbox project ${projectId}:`, e))
  }
}
