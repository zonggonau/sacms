import "server-only"

import { randomBytes } from "crypto"
import { db } from "@/lib/database"
import { deployToVercel } from "@/lib/vercel-client"
import { resolveFrontendEnv, pushEnvToVercelProject } from "./frontend-env"

export interface DeployFile {
  name: string
  content: string
}

export interface DeployFrontendResult {
  deploymentId: string
  url: string
  state: string
  vercelProjectId?: string
  apiKeyName: string
  simulated: boolean
}

/**
 * Deploys a tenant's frontend files to its one real Vercel project
 * (`sacms-<slug>` — Vercel's deployments API reuses the existing project on
 * repeat calls with the same name rather than creating a new one, so this
 * is safe to call again and again as the site changes). Extracted out of
 * `ai-builder/deploy`'s route handler so AI Site's "Publish" action can
 * deploy through the exact same path instead of a second, parallel one —
 * same Vercel project, same auto-provisioned API key, same env injection,
 * so the dashboard's existing domain-management UI (/infrastructure) works
 * for an AI-Site-published site with no extra code.
 */
export async function deployTenantFrontend(
  tenantId: string,
  tenantSlug: string,
  origin: string,
  files: DeployFile[],
): Promise<DeployFrontendResult> {
  let tokenRecord = await db.apiToken.findFirst({
    where: { tenantId, name: `SaCMS Site (${tenantSlug})` },
  })

  if (!tokenRecord) {
    const generatedToken = `sacms_live_${randomBytes(24).toString("hex")}`
    tokenRecord = await db.apiToken.create({
      data: {
        tenantId,
        name: `SaCMS Site (${tenantSlug})`,
        token: generatedToken,
        type: "service",
        permissions: ["read", "write"],
      },
    })
  }

  const projectName = `sacms-${tenantSlug}`
  const envVars = await resolveFrontendEnv(tenantId, tenantSlug, origin)
  const deployResult = await deployToVercel(projectName, files, envVars)

  if (deployResult.projectId && !deployResult.simulated) {
    pushEnvToVercelProject(deployResult.projectId, envVars)
      .then((r) => {
        if (r.failed.length) console.warn("[deploy] Vercel env push partial:", r.failed)
      })
      .catch((e) => console.warn("[deploy] Vercel env push failed:", e))
  }

  await Promise.all([
    db.tenant.update({
      where: { id: tenantId },
      data: {
        vercelDeploymentUrl: deployResult.url,
        vercelProjectId: deployResult.projectId || undefined,
      },
    }).catch((err) => console.warn("Failed to update tenant vercel fields:", err)),
    db.setting.upsert({
      where: { key: `${tenantId}_v0Status` },
      update: { value: "project" },
      create: { tenantId, key: `${tenantId}_v0Status`, value: "project" },
    }),
    db.setting.upsert({
      where: { key: `${tenantId}_vercelDeploymentUrl` },
      update: { value: deployResult.url },
      create: { tenantId, key: `${tenantId}_vercelDeploymentUrl`, value: deployResult.url },
    }),
    db.setting.upsert({
      where: { key: `${tenantId}_vercelProjectId` },
      update: { value: deployResult.projectId || "" },
      create: { tenantId, key: `${tenantId}_vercelProjectId`, value: deployResult.projectId || "" },
    }),
  ])

  return {
    deploymentId: deployResult.id,
    url: deployResult.url,
    state: deployResult.state,
    vercelProjectId: deployResult.projectId,
    apiKeyName: tokenRecord.name,
    simulated: deployResult.simulated ?? false,
  }
}
