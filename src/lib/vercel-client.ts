/**
 * Vercel REST API Client
 * Handles deployments, custom domains, and DNS configuration
 * Docs: https://vercel.com/docs/rest-api
 */

const VERCEL_API_BASE = "https://api.vercel.com"

function getVercelHeaders() {
  const token = process.env.VERCEL_ACCESS_TOKEN
  if (!token) throw new Error("VERCEL_ACCESS_TOKEN is not configured")
  return {
    "Authorization": `Bearer ${token}`,
    "Content-Type": "application/json"
  }
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
  files: { name: string; content: string }[]
): Promise<VercelDeploymentResult> {
  const headers = getVercelHeaders()

  const deployFiles: VercelDeploymentFile[] = files.map(f => ({
    file: f.name,
    data: f.content,
    encoding: "utf-8"
  }))

  const body = {
    name: projectName,
    files: deployFiles,
    projectSettings: {
      framework: "nextjs",
    },
    target: "production"
  }

  const res = await fetch(`${VERCEL_API_BASE}/v13/deployments`, {
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
  const res = await fetch(`${VERCEL_API_BASE}/v13/deployments/${deploymentId}`, {
    headers: getVercelHeaders()
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
  const res = await fetch(`${VERCEL_API_BASE}/v10/projects/${projectId}/domains`, {
    method: "POST",
    headers: getVercelHeaders(),
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
  const res = await fetch(`${VERCEL_API_BASE}/v6/domains/${domain}/config`, {
    headers: getVercelHeaders()
  })

  if (!res.ok) {
    return { configured: false }
  }

  const data = await res.json()
  return {
    cname: data.cnames?.[0] || data.recommendedCNAME?.[0],
    aRecord: data.aValues?.[0],
    configured: data.misconfigured === false
  }
}

/**
 * List all projects on Vercel account
 */
export async function listVercelProjects(): Promise<{ id: string; name: string; url: string }[]> {
  const res = await fetch(`${VERCEL_API_BASE}/v9/projects?limit=20`, {
    headers: getVercelHeaders()
  })

  if (!res.ok) return []
  const data = await res.json()
  return (data.projects || []).map((p: any) => ({
    id: p.id,
    name: p.name,
    url: p.alias?.[0]?.domain ? `https://${p.alias[0].domain}` : ""
  }))
}
