/**
 * Vercel REST API Client
 * Handles deployments, custom domains, and DNS configuration for tenant frontends deployed to Vercel
 * Docs: https://vercel.com/docs/rest-api
 */

import { getPlatformSettings } from "./settings"
import { isMockAllowed, requireCredentialOutsideMock } from "./dev-mode"
import { ROOT_DOMAIN } from "./portal-urls"

const VERCEL_API_BASE = "https://api.vercel.com"

/**
 * Shared root for every tenant's auto-assigned SaCMS-branded subdomain
 * (`<tenantSlug>.sites.sacms.cloud`) — a dedicated label under the main
 * domain, deliberately NOT the bare apex (`sacms.cloud` itself already
 * serves the main SaCMS app via Caddy on the production VPS; pointing a
 * wildcard at Vercel for the apex or an existing subdomain like cms./
 * admin. would break that). Requires a one-time wildcard DNS record
 * (`*.sites.sacms.cloud` CNAME -> cname.vercel-dns.com) and `sacms.cloud`
 * registered as a Team domain in Vercel — both set up once outside this
 * codebase, not something any API call here can create.
 */
const BRANDED_SUBDOMAIN_ROOT = `sites.${ROOT_DOMAIN}`

/**
 * Root for a Website Template's live-demo subdomain
 * (`<templateSlug>.demo.sacms.cloud`) — deliberately a different label
 * from `BRANDED_SUBDOMAIN_ROOT` so a template preview the SaCMS team is
 * testing is never mistaken for a real customer's own deployed site. Same
 * one-time external setup required (wildcard DNS + the apex registered as
 * a Team domain in Vercel).
 */
const DEMO_SUBDOMAIN_ROOT = `demo.${ROOT_DOMAIN}`

export async function getVercelToken(): Promise<string> {
  try {
    const settings = await getPlatformSettings()
    if (settings?.vercelAccessToken?.trim()) {
      return settings.vercelAccessToken.trim()
    }
  } catch {}
  return (process.env.VERCEL_ACCESS_TOKEN || process.env.VERCEL_API_TOKEN || "").trim()
}

/** Same Settings-DB-first, env-fallback resolution as `getVercelToken` — set
 *  from Admin > Settings > Mesin AI, or `VERCEL_TEAM_ID` in `.env`/the
 *  container's environment either way, local or production. */
export async function getVercelTeamId(): Promise<string> {
  try {
    const settings = await getPlatformSettings()
    if (settings?.vercelTeamId?.trim()) {
      return settings.vercelTeamId.trim()
    }
  } catch {}
  return (process.env.VERCEL_TEAM_ID || "").trim()
}

/** Same resolution as `getVercelTeamId` — the Vercel project AI Site's
 *  Sandbox previews run under. */
export async function getVercelProjectId(): Promise<string> {
  try {
    const settings = await getPlatformSettings()
    if (settings?.vercelProjectId?.trim()) {
      return settings.vercelProjectId.trim()
    }
  } catch {}
  return (process.env.VERCEL_PROJECT_ID || "").trim()
}

async function getVercelHeaders() {
  const token = await getVercelToken()
  if (!token) throw new Error("VERCEL_ACCESS_TOKEN is not configured in settings or environment")
  return {
    "Authorization": `Bearer ${token}`,
    "Content-Type": "application/json"
  }
}

async function getTeamQuery() {
  const teamId = await getVercelTeamId()
  return teamId ? `?teamId=${teamId}` : ""
}

export interface VercelDeploymentFile {
  file: string
  data: string
  encoding?: "base64" | "utf-8"
}

export interface VercelDeploymentResult {
  id: string
  url: string
  state: string
  projectId?: string
  projectName?: string
  /** true when VERCEL_ACCESS_TOKEN isn't configured and this is a fabricated,
   *  non-functional result — callers MUST surface this, never present it as a
   *  real deployment. */
  simulated?: boolean
}

export interface VercelDomainResult {
  name: string
  cname?: string
  aValue?: string
  verified: boolean
  verificationRequired: boolean
  verificationRecords?: {
    type: string
    domain: string
    value: string
  }[]
  /** true when VERCEL_ACCESS_TOKEN isn't configured — see VercelDeploymentResult. */
  simulated?: boolean
}

/**
 * Create a deployment on Vercel from a set of files
 */
export async function deployToVercel(
  projectName: string,
  files: { name: string; content: string }[],
  envVars?: Record<string, string>,
  /** Used to auto-attach `<tenantSlug>.sites.sacms.cloud` to the project
   *  (see ensureBrandedSubdomain) — omit to skip that and fall back to
   *  the project's existing alias/custom domain/*.vercel.app only. */
  tenantSlug?: string,
): Promise<VercelDeploymentResult> {
  const token = await getVercelToken()
  
  // Fallback for local dev without a token: fabricate a result so the flow is
  // exercisable end-to-end, but it MUST be flagged `simulated` — callers are
  // expected to reject/warn on this in any environment that isn't local dev,
  // rather than presenting it as a real deployment.
  if (!token) {
    if (!isMockAllowed("vercel", false)) requireCredentialOutsideMock("vercel", "VERCEL_ACCESS_TOKEN")
    console.warn("[Vercel Client] VERCEL_ACCESS_TOKEN not set in settings or env. Simulating instant deployment.")
    const sanitizedName = projectName.toLowerCase().replace(/[^a-z0-9-]/g, "-")
    return {
      id: `dpl_${Date.now()}`,
      url: `https://${sanitizedName}.vercel.app`,
      state: "READY",
      projectId: `prj_${Date.now()}`,
      projectName: sanitizedName,
      simulated: true,
    }
  }

  const headers = await getVercelHeaders()
  const teamQuery = await getTeamQuery()

  const deployFiles: VercelDeploymentFile[] = files.map(f => ({
    file: f.name,
    data: f.content,
    encoding: "utf-8"
  }))

  const body: Record<string, any> = {
    name: projectName.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
    files: deployFiles,
    projectSettings: {
      framework: "nextjs",
    },
    target: "production"
  }

  if (envVars && Object.keys(envVars).length > 0) {
    body.env = envVars
  }

  const res = await fetch(`${VERCEL_API_BASE}/v13/deployments${teamQuery}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body)
  })

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: res.statusText }))
    throw new Error(`Vercel deployment failed: ${error.error?.message || error.message || res.statusText}`)
  }

  const data = await res.json()
  // `data.url` is the unique per-deployment URL (the random-suffix hostname
  // like project-abc123-team.vercel.app) — Vercel's "Vercel Authentication"
  // deployment protection gates THAT hostname by default on every project
  // that has it enabled, even for a `target: "production"` deploy like this
  // one, and it doesn't even resolve publicly until the build finishes.
  // `data.alias` on THIS deploy-creation response is unreliable — empty
  // more often than not, since aliasing to the project's production domain
  // happens once the build is actually ready, which can race with this
  // response — so don't trust it. Ask the PROJECT for its own stable
  // alias list instead (custom domain if attached, else the default
  // <project>.vercel.app), same as every later deploy will have; that's
  // the one link safe to hand back as "where to see this live". Attach
  // this tenant's branded subdomain first (best-effort, idempotent) so a
  // brand-new project shows it immediately instead of only from the next
  // deploy onward.
  if (data.projectId && tenantSlug) {
    await ensureBrandedSubdomain(data.projectId, tenantSlug)
  }
  const publicUrl = data.projectId ? await getProjectPrimaryDomain(data.projectId) : null
  const fallbackAlias: string | undefined = Array.isArray(data.alias) ? data.alias[0] : undefined
  return {
    id: data.id,
    url: publicUrl || (fallbackAlias ? `https://${fallbackAlias}` : (data.url ? `https://${data.url}` : "")),
    state: data.readyState || data.state || "BUILDING",
    projectId: data.projectId,
    projectName: data.name
  }
}

/**
 * Re-run the project's most recent production deployment — exactly what
 * clicking "Redeploy" in the Vercel dashboard does: a fresh build of the
 * same source, with no file re-upload needed, picking up whatever the
 * Project's current env vars are. Needed because `add_deployment_env`/the
 * Environment tab can only change a Vercel PROJECT's stored env vars; an
 * already-live deployment keeps running with whatever was baked into it at
 * build time until something triggers a new build.
 *
 * Explicitly passes `env` on the redeploy request rather than trusting
 * Vercel to re-read the project's live env store for an inherited
 * redeploy — the create-deployment docs only promise env vars are
 * "inherited from the original unless explicitly overridden", which reads
 * as "frozen at the original deployment" rather than "always live", so this
 * passes the just-resolved values explicitly to guarantee they win.
 */
export async function redeployLatest(
  projectId: string,
  projectName: string,
  envVars?: Record<string, string>,
): Promise<VercelDeploymentResult> {
  const token = await getVercelToken()
  if (!token) {
    if (!isMockAllowed("vercel", false)) requireCredentialOutsideMock("vercel", "VERCEL_ACCESS_TOKEN")
    const sanitizedName = projectName.toLowerCase().replace(/[^a-z0-9-]/g, "-")
    return {
      id: `dpl_${Date.now()}`,
      url: `https://${sanitizedName}.vercel.app`,
      state: "READY",
      projectId,
      projectName: sanitizedName,
      simulated: true,
    }
  }

  const headers = await getVercelHeaders()
  const teamId = await getVercelTeamId()

  const listParams = new URLSearchParams({ projectId, target: "production", limit: "1" })
  if (teamId) listParams.set("teamId", teamId)
  const listRes = await fetch(`${VERCEL_API_BASE}/v7/deployments?${listParams.toString()}`, { headers })
  if (!listRes.ok) {
    const error = await listRes.json().catch(() => ({ message: listRes.statusText }))
    throw new Error(`Gagal mengambil riwayat deployment dari Vercel: ${error.error?.message || error.message || listRes.statusText}`)
  }
  const listData = await listRes.json().catch(() => ({}))
  const latest = Array.isArray(listData.deployments) ? listData.deployments[0] : null
  if (!latest?.uid) {
    throw new Error("Belum ada deployment sebelumnya untuk di-redeploy. Deploy terlebih dahulu lewat deploy_to_sacms.")
  }

  const body: Record<string, any> = {
    name: projectName.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
    project: projectId,
    deploymentId: latest.uid,
    target: "production",
  }
  if (envVars && Object.keys(envVars).length > 0) body.env = envVars

  const res = await fetch(`${VERCEL_API_BASE}/v13/deployments${await getTeamQuery()}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: res.statusText }))
    throw new Error(`Redeploy gagal: ${error.error?.message || error.message || res.statusText}`)
  }

  const data = await res.json()
  const publicUrl = data.projectId ? await getProjectPrimaryDomain(data.projectId) : null
  const fallbackAlias: string | undefined = Array.isArray(data.alias) ? data.alias[0] : undefined
  return {
    id: data.id,
    url: publicUrl || (fallbackAlias ? `https://${fallbackAlias}` : (data.url ? `https://${data.url}` : "")),
    state: data.readyState || data.state || "BUILDING",
    projectId: data.projectId || projectId,
    projectName: data.name,
  }
}

/**
 * Get deployment status
 */
export async function getDeploymentStatus(deploymentId: string): Promise<{ state: string; url: string; projectId?: string; simulated?: boolean }> {
  const token = await getVercelToken()
  if (!token) {
    if (!isMockAllowed("vercel", false)) requireCredentialOutsideMock("vercel", "VERCEL_ACCESS_TOKEN")
    return { state: "READY", url: `https://sacms-site.vercel.app`, simulated: true }
  }

  const res = await fetch(`${VERCEL_API_BASE}/v13/deployments/${deploymentId}${await getTeamQuery()}`, {
    headers: await getVercelHeaders()
  })

  if (!res.ok) throw new Error("Failed to get deployment status")
  const data = await res.json()
  return {
    state: data.readyState || data.state || "BUILDING",
    url: data.url ? `https://${data.url}` : "",
    projectId: data.projectId || undefined,
  }
}

/**
 * Whether the project's "Vercel Authentication" deployment protection is on
 * (and, if so, which deployment types it covers) — read-only, used to warn
 * the caller instead of guessing from a single deployment's response shape.
 */
export async function getVercelDeploymentProtectionStatus(
  projectId: string,
): Promise<{ protected: boolean; scope?: string } | null> {
  const token = await getVercelToken()
  if (!token) return null

  const res = await fetch(`${VERCEL_API_BASE}/v9/projects/${projectId}${await getTeamQuery()}`, {
    headers: await getVercelHeaders(),
  })
  if (!res.ok) return null
  const data = await res.json().catch(() => ({}))
  const sso = data?.ssoProtection
  return { protected: !!sso, scope: sso?.deploymentType }
}

/**
 * Whether a Vercel project still exists — used to detect "the user deleted
 * this project directly on vercel.com" instead of trusting our own stored
 * vercelDeploymentUrl/vercelProjectId forever.
 *
 * Returns `false` only on a definitive 404 (confirmed deleted). Any other
 * outcome (no token configured, network error, rate limit, 5xx) returns
 * `null` — "couldn't verify" — so a transient failure never gets treated
 * as "deleted" and hides a site that's actually still live.
 */
export async function checkVercelProjectExists(projectId: string): Promise<boolean | null> {
  const token = await getVercelToken()
  if (!token) return null

  try {
    const res = await fetch(`${VERCEL_API_BASE}/v9/projects/${projectId}${await getTeamQuery()}`, {
      headers: await getVercelHeaders(),
    })
    if (res.status === 404) return false
    if (res.ok) return true
    return null
  } catch {
    return null
  }
}

/**
 * Permanently deletes a Vercel project and every deployment under it.
 * Irreversible on Vercel's side — callers must confirm with the user before
 * calling this, there is no undo. A 404 (project already gone, e.g. deleted
 * directly on vercel.com) is treated as success since the end state is the
 * same either way.
 */
export async function deleteVercelProject(projectId: string): Promise<{ ok: boolean; error?: string }> {
  const token = await getVercelToken()
  if (!token) {
    if (!isMockAllowed("vercel", false)) requireCredentialOutsideMock("vercel", "VERCEL_ACCESS_TOKEN")
    return { ok: true }
  }

  const res = await fetch(`${VERCEL_API_BASE}/v9/projects/${projectId}${await getTeamQuery()}`, {
    method: "DELETE",
    headers: await getVercelHeaders(),
  })

  if (!res.ok && res.status !== 404) {
    const data = await res.json().catch(() => ({}))
    return { ok: false, error: data.error?.message || data.message || res.statusText }
  }
  return { ok: true }
}

/**
 * Turn off Vercel's "Vercel Authentication" deployment protection for a
 * project, so its deployment URLs (including the per-deployment ones with a
 * random suffix, not just the production alias) are viewable by anyone with
 * the link — no Vercel login required. This is a project-wide, security-
 * relevant setting change, so it's only ever called when a caller explicitly
 * asks for it (the `make_vercel_deployment_public` MCP tool / dashboard
 * action) — never automatically on every deploy.
 */
export async function disableVercelDeploymentProtection(
  projectId: string,
): Promise<{ ok: boolean; error?: string }> {
  const token = await getVercelToken()
  if (!token) {
    if (!isMockAllowed("vercel", false)) requireCredentialOutsideMock("vercel", "VERCEL_ACCESS_TOKEN")
    return { ok: true }
  }

  const res = await fetch(`${VERCEL_API_BASE}/v9/projects/${projectId}${await getTeamQuery()}`, {
    method: "PATCH",
    headers: await getVercelHeaders(),
    // Clearing both known protection fields — Vercel's API has used
    // `ssoProtection` (Vercel Authentication) and, on some plans,
    // `passwordProtection` for the same "require login to view" behavior.
    body: JSON.stringify({ ssoProtection: null, passwordProtection: null }),
  })

  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    return { ok: false, error: data.error?.message || data.message || res.statusText }
  }
  return { ok: true }
}

/**
 * Shared idempotent "attach `<label>.<root>` to this Vercel project"
 * logic behind both `ensureBrandedSubdomain` (real tenant deployments,
 * `sites.<ROOT_DOMAIN>`) and `ensureDemoSubdomain` (Website Template demo
 * deployments, `demo.<ROOT_DOMAIN>`) below. Best-effort: swallows any
 * failure (e.g. the root's one-time wildcard DNS record isn't live yet)
 * rather than failing the deploy that triggered it — getProjectPrimaryDomain
 * falls back to the project's default `.vercel.app` alias when this hasn't
 * succeeded (yet, or at all).
 */
async function attachAutoSubdomain(projectId: string, label: string, root: string): Promise<string | null> {
  const token = await getVercelToken()
  if (!token) return null

  const clean = label.toLowerCase().replace(/[^a-z0-9-]/g, "-")
  if (!clean) return null
  const domain = `${clean}.${root}`

  try {
    await addDomainToProject(projectId, domain)
    return domain
  } catch (err: any) {
    console.warn(`[Vercel Client] Failed to attach subdomain ${domain}:`, err?.message || err)
    return null
  }
}

/**
 * Idempotently attaches this tenant's SaCMS-branded subdomain
 * (`<tenantSlug>.sites.sacms.cloud`) to its Vercel project, so a
 * brand-new project has a clean, SaCMS-looking domain from its very
 * first deploy instead of only a raw `*.vercel.app` alias.
 */
export async function ensureBrandedSubdomain(projectId: string, tenantSlug: string): Promise<string | null> {
  return attachAutoSubdomain(projectId, tenantSlug, BRANDED_SUBDOMAIN_ROOT)
}

/**
 * Idempotently attaches a Website Template's live-demo subdomain
 * (`<templateSlug>.demo.sacms.cloud`) to its demo Vercel project — a
 * separate root from `ensureBrandedSubdomain`'s `sites.` so a template
 * preview the SaCMS team is iterating on is never mistaken for a real
 * customer's own deployed site. Requires the same kind of one-time
 * wildcard DNS record (`*.demo.<ROOT_DOMAIN>` CNAME -> cname.vercel-dns.com)
 * that `sites.` already needed, set up outside this codebase.
 */
export async function ensureDemoSubdomain(projectId: string, templateSlug: string): Promise<string | null> {
  return attachAutoSubdomain(projectId, templateSlug, DEMO_SUBDOMAIN_ROOT)
}

/**
 * The one URL that's actually safe to hand a real visitor for a project,
 * in priority order: (1) a real custom domain the tenant bought and
 * attached themselves (e.g. bangparjo.shop, via configure_deployment_domain
 * or the dashboard's Infrastructure > Domains tab), (2) this tenant's
 * SaCMS-branded subdomain (`<tenantSlug>.sites.sacms.cloud`, see
 * ensureBrandedSubdomain), (3) the project's default `<project>.vercel.app`
 * alias as a last resort. NEVER the per-deployment URL a fresh deploy's own
 * API response carries (the unique, random-suffixed hostname like
 * `project-abc123-team.vercel.app`), which Vercel's "Vercel Authentication"
 * deployment protection gates by default even when the project itself is
 * otherwise public, and which doesn't resolve at all until the deploy's
 * build finishes (so it's also simply wrong to hand back the instant a
 * deploy is *requested*, before it's ready).
 *
 * Reads the project's own domains list (`GET /v9/projects/{id}/domains`)
 * rather than a single deployment's response, since a project's domains
 * are assigned once and then stay stable across every later deploy — this
 * is what should be shown back to the user/agent after every
 * deploy_to_sacms call, not deployToVercel's own `result.url`.
 *
 * Deliberately NOT `GET /v9/projects/{id}`'s own `alias` field: that only
 * reflects the aliases Vercel assigned while *aliasing a deployment*
 * (production deploy time), and stays `[]` for any domain attached later
 * via `addDomainToProject`/`ensureBrandedSubdomain` even once Vercel has
 * fully verified and routed it — confirmed live on a real project whose
 * branded `sites.sacms.cloud` subdomain was verified and serving traffic
 * while `alias` still read `[]`, which silently defeated the self-heal in
 * `hosting-status.ts` (it kept "healing" back to the same `.vercel.app`
 * default). The domains endpoint carries each domain's own `verified`
 * flag directly, so only domains Vercel has actually confirmed are
 * eligible to be shown.
 */
export async function getProjectPrimaryDomain(projectId: string): Promise<string | null> {
  const token = await getVercelToken()
  if (!token) return null

  try {
    const res = await fetch(`${VERCEL_API_BASE}/v9/projects/${projectId}/domains${await getTeamQuery()}`, {
      headers: await getVercelHeaders(),
    })
    if (!res.ok) return null
    const data = await res.json().catch(() => ({}))
    const domains: string[] = Array.isArray(data?.domains)
      ? data.domains.filter((d: any) => d?.verified).map((d: any) => d?.name).filter((d: unknown): d is string => typeof d === "string")
      : []
    if (domains.length === 0) return null

    const external = domains.find((d) => !d.endsWith(".vercel.app") && !d.endsWith(`.${BRANDED_SUBDOMAIN_ROOT}`))
    const branded = domains.find((d) => d.endsWith(`.${BRANDED_SUBDOMAIN_ROOT}`))
    return `https://${external || branded || domains[0]}`
  } catch {
    return null
  }
}

export type VercelEnvTarget = "production" | "preview" | "development"

export interface VercelEnvResult {
  key: string
  targets: VercelEnvTarget[]
  type: "encrypted" | "plain" | "sensitive"
  created: boolean
  updated: boolean
  simulated?: boolean
}

/**
 * Create or update an environment variable on a Vercel project (upsert).
 * Secret values are stored `encrypted`; anything prefixed `NEXT_PUBLIC_` is
 * stored `plain` since it's exposed to the browser anyway.
 */
export async function upsertVercelProjectEnv(
  projectId: string,
  key: string,
  value: string,
  targets: VercelEnvTarget[] = ["production", "preview", "development"],
): Promise<VercelEnvResult> {
  const type: VercelEnvResult["type"] = key.startsWith("NEXT_PUBLIC_") ? "plain" : "encrypted"
  const token = await getVercelToken()
  if (!token) {
    if (!isMockAllowed("vercel", false)) requireCredentialOutsideMock("vercel", "VERCEL_ACCESS_TOKEN")
    return { key, targets, type, created: true, updated: false, simulated: true }
  }

  const teamQuery = await getTeamQuery()
  const res = await fetch(
    `${VERCEL_API_BASE}/v10/projects/${projectId}/env${teamQuery ? `${teamQuery}&upsert=true` : "?upsert=true"}`,
    {
      method: "POST",
      headers: await getVercelHeaders(),
      body: JSON.stringify({ key, value, type, target: targets }),
    },
  )

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(`Failed to set Vercel env "${key}": ${data.error?.message || data.message || res.statusText}`)
  }

  const created = data?.created?.key === key || data?.key === key
  return { key, targets, type, created: !!created, updated: !created }
}

/**
 * Add a custom domain to a Vercel project
 */
export async function addDomainToProject(
  projectId: string,
  domain: string
): Promise<VercelDomainResult> {
  const token = await getVercelToken()
  if (!token) {
    if (!isMockAllowed("vercel", false)) requireCredentialOutsideMock("vercel", "VERCEL_ACCESS_TOKEN")
    return {
      name: domain,
      verified: true,
      verificationRequired: false,
      verificationRecords: [],
      simulated: true,
    }
  }

  const res = await fetch(`${VERCEL_API_BASE}/v10/projects/${projectId}/domains${await getTeamQuery()}`, {
    method: "POST",
    headers: await getVercelHeaders(),
    body: JSON.stringify({ name: domain })
  })

  const data = await res.json()

  if (!res.ok && res.status !== 409) {
    throw new Error(`Failed to add domain: ${data.error?.message || data.message || res.statusText}`)
  }

  return {
    name: domain,
    verified: data.verified ?? false,
    verificationRequired: !!(data.verification && data.verification.length > 0),
    verificationRecords: data.verification?.map((v: any) => ({
      type: v.type,
      domain: v.domain,
      value: v.value
    })) || []
  }
}

/**
 * Detach a custom domain from a Vercel project — best-effort counterpart to
 * `addDomainToProject`, called when a workspace changes or removes its
 * deployment's custom domain so Vercel's own domain list doesn't keep
 * accumulating every domain ever typed in. A 404 (already detached, or
 * never actually attached — e.g. the add call failed) is not an error here.
 */
export async function removeDomainFromProject(projectId: string, domain: string): Promise<void> {
  const token = await getVercelToken()
  if (!token) return

  const res = await fetch(`${VERCEL_API_BASE}/v9/projects/${projectId}/domains/${domain}${await getTeamQuery()}`, {
    method: "DELETE",
    headers: await getVercelHeaders(),
  })
  if (!res.ok && res.status !== 404) {
    const error = await res.json().catch(() => ({ message: res.statusText }))
    throw new Error(`Failed to remove domain: ${error.error?.message || error.message || res.statusText}`)
  }
}

/**
 * Get the recommended DNS configuration for a domain
 */
export async function getDomainConfig(domain: string): Promise<{
  cname?: string
  aRecord?: string
  configured: boolean
  simulated?: boolean
  /** Set when the Vercel API call itself failed (bad token, rate limit,
   *  5xx, etc.) — `configured: false` in that case does NOT mean the
   *  domain's DNS is actually misconfigured, it means we couldn't check.
   *  Callers MUST surface this distinctly rather than telling the user
   *  their DNS is wrong when it's really our API call that failed. */
  error?: string
}> {
  const token = await getVercelToken()
  if (!token) {
    if (!isMockAllowed("vercel", false)) requireCredentialOutsideMock("vercel", "VERCEL_ACCESS_TOKEN")
    return { cname: "cname.vercel-dns.com", aRecord: "76.76.21.21", configured: true, simulated: true }
  }

  const res = await fetch(`${VERCEL_API_BASE}/v6/domains/${domain}/config${await getTeamQuery()}`, {
    headers: await getVercelHeaders()
  })

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({ message: res.statusText }))
    return {
      configured: false,
      error: `Failed to check domain configuration with Vercel: ${errBody.error?.message || errBody.message || res.statusText}`,
    }
  }

  const data = await res.json()
  return {
    cname: data.cnames?.[0] || data.recommendedCNAME?.[0]?.value || "cname.vercel-dns.com",
    aRecord: data.aValues?.[0] || data.recommendedIPv4?.[0]?.value?.[0] || "76.76.21.21",
    configured: data.misconfigured === false
  }
}

/**
 * List all projects on Vercel account
 */
export async function listVercelProjects(): Promise<{ id: string; name: string; url: string }[]> {
  const token = await getVercelToken()
  if (!token) return []

  const res = await fetch(`${VERCEL_API_BASE}/v10/projects?limit=20${(await getTeamQuery()).replace("?", "&")}`, {
    headers: await getVercelHeaders()
  })

  if (!res.ok) return []
  const data = await res.json()
  // The v10 response is documented as either a bare array or a
  // `{ projects, pagination }` object depending on request shape.
  const projects = Array.isArray(data) ? data : (data.projects || [])
  return projects.map((p: any) => ({
    id: p.id,
    name: p.name,
    url: p.alias?.[0]?.domain ? `https://${p.alias[0].domain}` : ""
  }))
}

export function isVercelConfigured(): Promise<boolean> {
  return getVercelToken().then((t) => Boolean(t))
}

export interface VercelProjectSummary {
  id: string
  name: string
  framework: string | null
  nodeVersion: string | null
  url: string
  latestDeploymentState: string | null
  latestDeploymentUrl: string | null
  latestDeploymentAt: number | null
  createdAt: number | null
  gitRepo: string | null
}

/**
 * Richer project listing for the admin infrastructure dashboard's "Vercel
 * Hosting" tab — every project on the account/team, with its latest
 * production deployment state. Read-only; returns [] (never throws) when no
 * Vercel token is configured or the API call fails.
 */
export async function listVercelProjectsDetailed(): Promise<VercelProjectSummary[]> {
  const token = await getVercelToken()
  if (!token) return []

  try {
    const headers = await getVercelHeaders()
    const teamParam = (await getTeamQuery()).replace("?", "&")
    const out: VercelProjectSummary[] = []
    let from: string | undefined
    let guard = 0

    while (guard < 20) {
      guard += 1
      const pageParam = from ? `&from=${from}` : ""
      const res = await fetch(
        `${VERCEL_API_BASE}/v10/projects?limit=100${teamParam}${pageParam}`,
        { headers },
      )
      if (!res.ok) {
        console.warn(`[Vercel Client] listVercelProjectsDetailed failed (${res.status})`)
        break
      }
      const data = await res.json()
      // The v10 response is documented as either a bare array or a
      // `{ projects, pagination }` object depending on request shape.
      const projectsPage = Array.isArray(data) ? data : (data.projects || [])
      for (const p of projectsPage) {
        const latest = p.latestDeployments?.[0] || p.targets?.production || null
        out.push({
          id: p.id,
          name: p.name,
          framework: p.framework ?? null,
          nodeVersion: p.nodeVersion ?? null,
          url: p.alias?.[0]?.domain
            ? `https://${p.alias[0].domain}`
            : latest?.url
              ? `https://${latest.url}`
              : "",
          latestDeploymentState: latest?.readyState || latest?.state || null,
          latestDeploymentUrl: latest?.url ? `https://${latest.url}` : null,
          latestDeploymentAt: latest?.createdAt ?? latest?.buildingAt ?? null,
          createdAt: p.createdAt ?? null,
          gitRepo: p.link?.repo
            ? `${p.link.org || p.link.owner || ""}/${p.link.repo}`.replace(/^\//, "")
            : null,
        })
      }
      const next = Array.isArray(data) ? null : data.pagination?.next
      if (!next) break
      from = String(next)
    }

    return out
  } catch (err: any) {
    console.warn("[Vercel Client] listVercelProjectsDetailed error:", err?.message || err)
    return []
  }
}
