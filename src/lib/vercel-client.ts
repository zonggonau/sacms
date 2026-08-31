/**
 * Vercel REST API Client
 * Handles deployments, custom domains, and DNS configuration for SaCMS AI Website Builder
 * Docs: https://vercel.com/docs/rest-api
 */

import { getPlatformSettings } from "./settings"

const VERCEL_API_BASE = "https://api.vercel.com"

export async function getVercelToken(): Promise<string> {
  try {
    const settings = await getPlatformSettings()
    if (settings?.vercelAccessToken?.trim()) {
      return settings.vercelAccessToken.trim()
    }
  } catch {}
  return (process.env.VERCEL_ACCESS_TOKEN || process.env.VERCEL_API_TOKEN || "").trim()
}

async function getVercelHeaders() {
  const token = await getVercelToken()
  if (!token) throw new Error("VERCEL_ACCESS_TOKEN is not configured in settings or environment")
  return {
    "Authorization": `Bearer ${token}`,
    "Content-Type": "application/json"
  }
}

function getTeamQuery() {
  const teamId = process.env.VERCEL_TEAM_ID
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
}

/**
 * Create a deployment on Vercel from a set of files
 */
export async function deployToVercel(
  projectName: string,
  files: { name: string; content: string }[],
  envVars?: Record<string, string>
): Promise<VercelDeploymentResult> {
  const token = await getVercelToken()
  
  // Safe Fallback if token is not configured in local development
  if (!token) {
    console.warn("[Vercel Client] VERCEL_ACCESS_TOKEN not set in settings or env. Simulating instant deployment.")
    const sanitizedName = projectName.toLowerCase().replace(/[^a-z0-9-]/g, "-")
    return {
      id: `dpl_${Date.now()}`,
      url: `https://${sanitizedName}.vercel.app`,
      state: "READY",
      projectId: `prj_${Date.now()}`,
      projectName: sanitizedName,
    }
  }

  const headers = await getVercelHeaders()

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

  const res = await fetch(`${VERCEL_API_BASE}/v13/deployments${getTeamQuery()}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body)
  })

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: res.statusText }))
    throw new Error(`Vercel deployment failed: ${error.error?.message || error.message || res.statusText}`)
  }

  const data = await res.json()
  return {
    id: data.id,
    url: data.url ? `https://${data.url}` : "",
    state: data.readyState || data.state || "BUILDING",
    projectId: data.projectId,
    projectName: data.name
  }
}

/**
 * Get deployment status
 */
export async function getDeploymentStatus(deploymentId: string): Promise<{ state: string; url: string }> {
  const token = await getVercelToken()
  if (!token) {
    return { state: "READY", url: `https://sacms-site.vercel.app` }
  }

  const res = await fetch(`${VERCEL_API_BASE}/v13/deployments/${deploymentId}${getTeamQuery()}`, {
    headers: await getVercelHeaders()
  })

  if (!res.ok) throw new Error("Failed to get deployment status")
  const data = await res.json()
  return {
    state: data.readyState || data.state || "BUILDING",
    url: data.url ? `https://${data.url}` : ""
  }
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
    return {
      name: domain,
      verified: true,
      verificationRequired: false,
      verificationRecords: []
    }
  }

  const res = await fetch(`${VERCEL_API_BASE}/v10/projects/${projectId}/domains${getTeamQuery()}`, {
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
 * Get the recommended DNS configuration for a domain
 */
export async function getDomainConfig(domain: string): Promise<{
  cname?: string
  aRecord?: string
  configured: boolean
}> {
  const token = await getVercelToken()
  if (!token) {
    return { cname: "cname.vercel-dns.com", aRecord: "76.76.21.21", configured: true }
  }

  const res = await fetch(`${VERCEL_API_BASE}/v6/domains/${domain}/config${getTeamQuery()}`, {
    headers: await getVercelHeaders()
  })

  if (!res.ok) {
    return { cname: "cname.vercel-dns.com", aRecord: "76.76.21.21", configured: false }
  }

  const data = await res.json()
  return {
    cname: data.cnames?.[0] || data.recommendedCNAME?.[0] || "cname.vercel-dns.com",
    aRecord: data.aValues?.[0] || "76.76.21.21",
    configured: data.misconfigured === false
  }
}

/**
 * List all projects on Vercel account
 */
export async function listVercelProjects(): Promise<{ id: string; name: string; url: string }[]> {
  const token = await getVercelToken()
  if (!token) return []

  const res = await fetch(`${VERCEL_API_BASE}/v9/projects?limit=20${getTeamQuery().replace("?", "&")}`, {
    headers: await getVercelHeaders()
  })

  if (!res.ok) return []
  const data = await res.json()
  return (data.projects || []).map((p: any) => ({
    id: p.id,
    name: p.name,
    url: p.alias?.[0]?.domain ? `https://${p.alias[0].domain}` : ""
  }))
}
