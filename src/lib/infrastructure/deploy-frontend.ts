import "server-only"

import { db } from "@/lib/database"
import { deployToVercel, redeployLatest } from "@/lib/vercel-client"
import { resolveFrontendEnv, pushEnvToVercelProject, resolveApiOrigin } from "./frontend-env"

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
  // `origin` reflects whoever is hitting this route's own browser session —
  // right for a real public domain, but a dead address to bake into a real
  // Vercel deployment when "Publish" is triggered from local dev's own
  // browser at http://localhost:3000 (nothing outside this machine can
  // reach that). Fall through to the same public-host guard used for
  // Sandbox previews instead of trusting it blindly.
  const isLocalOrigin = /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?\/?$/i.test(origin)
  const projectName = `sacms-${tenantSlug}`
  const envVars = await resolveFrontendEnv(tenantId, tenantSlug, isLocalOrigin ? resolveApiOrigin() : origin)
  const deployResult = await deployToVercel(projectName, files, envVars, tenantSlug)

  return persistDeployResult(tenantId, tenantSlug, deployResult, envVars)
}

/**
 * Re-run the workspace's existing deployment project on Vercel — no files
 * to upload, just a fresh build of whatever was last deployed so a
 * project-level env var change (Environment tab / `add_deployment_env`)
 * actually takes effect on the live site. Mirrors `deployTenantFrontend`'s
 * persistence tail; the only difference is how the Vercel deployment
 * itself is produced (`redeployLatest` vs `deployToVercel`).
 */
export async function redeployTenantFrontend(tenantId: string, tenantSlug: string): Promise<DeployFrontendResult> {
  const tenant = await db.tenant.findUnique({ where: { id: tenantId }, select: { vercelProjectId: true } })
  const projectId = tenant?.vercelProjectId
  if (!projectId) {
    throw new Error("Belum ada deployment untuk workspace ini. Deploy terlebih dahulu lewat deploy_to_sacms.")
  }

  const projectName = `sacms-${tenantSlug}`
  const envVars = await resolveFrontendEnv(tenantId, tenantSlug, resolveApiOrigin())
  const deployResult = await redeployLatest(projectId, projectName, envVars)

  return persistDeployResult(tenantId, tenantSlug, deployResult, envVars)
}

async function persistDeployResult(
  tenantId: string,
  tenantSlug: string,
  deployResult: Awaited<ReturnType<typeof deployToVercel>>,
  envVars: Record<string, string>,
): Promise<DeployFrontendResult> {
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
    apiKeyName: `SaCMS Cloud Hosting (${tenantSlug})`,
    simulated: deployResult.simulated ?? false,
  }
}
