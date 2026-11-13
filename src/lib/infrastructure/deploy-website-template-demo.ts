import "server-only"

import { db } from "@/lib/database"
import { deployToVercel, ensureDemoSubdomain, getProjectPrimaryDomain } from "@/lib/vercel-client"
import { resolveWebsiteTemplateEnvVars } from "./frontend-env"
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
  error?: string
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
 */
export async function deployWebsiteTemplateDemo(
  websiteTemplate: WebsiteTemplateDemoInput,
): Promise<DeployWebsiteTemplateDemoResult> {
  try {
    const demoTenant = await ensureDemoTenantForSchemaTemplate(websiteTemplate.schemaTemplate)

    const files = websiteTemplate.files.map((f) => ({ name: f.path, content: f.content }))
    const resolvedEnvVars = await resolveWebsiteTemplateEnvVars(demoTenant.id, demoTenant.slug, websiteTemplate.files)
    const envVars = Object.fromEntries(resolvedEnvVars.map((v) => [v.key, v.value]))

    const projectName = `sacms-demo-${websiteTemplate.slug}`
    const deployResult = await deployToVercel(projectName, files, envVars)

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
      },
    })

    return { url }
  } catch (err: any) {
    console.warn(`[deploy-website-template-demo] Failed to deploy demo for ${websiteTemplate.slug}:`, err)
    return { url: null, error: err?.message || "Gagal men-deploy demo" }
  }
}
