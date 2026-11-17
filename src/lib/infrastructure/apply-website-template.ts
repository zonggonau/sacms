import { db, getTenantDb } from "@/lib/database"
import { materializeSchemaIntoTenant } from "@/lib/schema-template-sync"
import { deployTenantFrontend } from "./deploy-frontend"
import {
  resolveApiOrigin,
  resolveWebsiteTemplateEnvVars,
  getTenantCustomEnvVarList,
  setTenantCustomEnvVars,
} from "./frontend-env"

export interface ApplyWebsiteTemplateInput {
  id: string
  files: unknown
  schemaTemplate: { schema: unknown }
}

export type ApplyWebsiteTemplateResult =
  | {
      ok: true
      imported: number
      envVarsApplied: string[]
      deployment: Awaited<ReturnType<typeof deployTenantFrontend>>
    }
  | { ok: false; code: "WORKSPACE_NOT_EMPTY"; message: string }

/**
 * Shared core of "Terapkan" (the dashboard's apply button) and the MCP
 * apply_website_template tool — materializes the Website Template's linked
 * Schema Template into this workspace's real Content Types/Single Types/
 * Components, pre-fills the Environment tab from the bundle's
 * `.env.example` (resolving any `{{SACMS_*}}` placeholder to this
 * workspace's real values), then deploys the bundled frontend. Extracted
 * from api/tenant/[tenant]/website-templates/[id]/apply/route.ts (Kabar
 * Nusa report P0: applying a template was dashboard-only, no MCP path at
 * all) so both callers run the exact same logic instead of two copies
 * drifting apart.
 *
 * Callers are responsible for their OWN gates before calling this:
 * whether the template exists/is published, billing (isTenantPlanPaid /
 * isHostingPlanPaid — the two callers phrase this check slightly
 * differently), and role/scope — none of that is this function's concern.
 */
export async function applyWebsiteTemplateToTenant(
  tenantId: string,
  tenantSlug: string,
  websiteTemplate: ApplyWebsiteTemplateInput,
): Promise<ApplyWebsiteTemplateResult> {
  // Empty-workspace guard — a Website Template's schema is tied to its own
  // specific Schema Template, so applying it on top of unrelated existing
  // structures would silently skip slug-conflicting models and leave a
  // confusing mix behind.
  const tenantDb = await getTenantDb(tenantSlug)
  const [hasCt, hasSt, hasComp] = await Promise.all([
    tenantDb.contentType.findFirst({ where: { tenantId }, select: { id: true } }),
    tenantDb.singleType.findFirst({ where: { tenantId }, select: { id: true } }),
    tenantDb.component.findFirst({ where: { tenantId }, select: { id: true } }),
  ])
  if (hasCt || hasSt || hasComp) {
    return {
      ok: false,
      code: "WORKSPACE_NOT_EMPTY",
      message: "Masih ada Content Type/Single Type/Component di workspace ini. Hapus dulu (tombol \"Hapus Semua Schema\") sebelum menerapkan Website Template.",
    }
  }

  const { imported } = await materializeSchemaIntoTenant(
    tenantDb,
    tenantId,
    websiteTemplate.schemaTemplate.schema as any,
  )

  // Pre-populate the Environment tab with whatever custom vars the bundled
  // frontend expects — resolved to this workspace's REAL production API
  // origin/tenant slug/deploy token wherever the template's .env(.example)
  // used a {{SACMS_*}} placeholder — BEFORE deploying, so the very first
  // deploy (and every Redeploy after it) already carries correct values
  // instead of the customer having to discover and fill them in by hand.
  const templateFiles = websiteTemplate.files as unknown as { path: string; content: string }[]
  const templateEnvVars = await resolveWebsiteTemplateEnvVars(tenantId, tenantSlug, templateFiles)
  if (templateEnvVars.length > 0) {
    const existing = await getTenantCustomEnvVarList(tenantId)
    const merged = [...existing]
    for (const v of templateEnvVars) {
      const idx = merged.findIndex((m) => m.key === v.key)
      if (idx >= 0) merged[idx] = v
      else merged.push(v)
    }
    await setTenantCustomEnvVars(tenantId, merged)
  }

  const files = templateFiles.map((f) => ({ name: f.path, content: f.content }))
  const deployResult = await deployTenantFrontend(tenantId, tenantSlug, resolveApiOrigin(), files)

  // Informational only (Hosting tab banner / the reset-website action) —
  // never gates anything, so a failure here must not fail an apply that
  // already succeeded. Only this apply path sets it; ordinary revisions
  // via deploy_to_sacms/deploy_website_patch/the dashboard's own deploy
  // button must not overwrite it, and only reset-website clears it.
  await db.tenant.update({
    where: { id: tenantId },
    data: { sourceWebsiteTemplateId: websiteTemplate.id },
  }).catch((err) => console.warn("Failed to set sourceWebsiteTemplateId after apply:", err))

  return {
    ok: true,
    imported,
    envVarsApplied: templateEnvVars.map((v) => v.key),
    deployment: deployResult,
  }
}
