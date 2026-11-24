import { db, getTenantDb } from "@/lib/database"
import { materializeSchemaIntoTenant } from "@/lib/schema-template-sync"
import { SITE_SETTINGS_SLUG } from "@/lib/content/site-settings-slug"
import { randomUUID } from "node:crypto"
import { websiteTemplateRunKey, type TemplateRun } from "./website-template-run"
import { schemaRequirements } from "./site-schema-contract"
import { buildManifest } from "./mcp-deployment-source"
import {
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
      sourceRevision: string
    }
  | { ok: false; code: "WORKSPACE_NOT_EMPTY"; message: string }

const APPLY_LEASE_MS = 10 * 60_000

/**
 * Shared core of "Terapkan" (the dashboard's apply button) and the MCP
 * apply_website_template tool — materializes the Website Template's linked
 * Schema Template into this workspace's real Content Types/Single Types/
 * Components, pre-fills the Environment tab from the bundle's
 * `.env.example` (resolving any `{{SACMS_*}}` placeholder to this
 * workspace's real values), then saves the bundled frontend as a workspace revision. Extracted
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
  const tenantDb = await getTenantDb(tenantSlug)
  const key = websiteTemplateRunKey(tenantId)
  let row = await db.setting.findUnique({ where: { key }, select: { value: true } })
  if (!row) {
    const [hasCt, hasSt, hasComp] = await Promise.all([
      tenantDb.contentType.findFirst({ where: { tenantId }, select: { id: true } }),
      tenantDb.singleType.findFirst({ where: { tenantId, slug: { not: SITE_SETTINGS_SLUG } }, select: { id: true } }),
      tenantDb.component.findFirst({ where: { tenantId }, select: { id: true } }),
    ])
    if (hasCt || hasSt || hasComp) {
      return {
        ok: false,
        code: "WORKSPACE_NOT_EMPTY",
        message: "Workspace sudah memiliki skema. Reset workspace sebelum menerapkan Website Template lain.",
      }
    }
    const initial: TemplateRun = { templateId: websiteTemplate.id, phase: "schema", lease: null, expiresAt: 0 }
    row = await db.setting.upsert({
      where: { key },
      update: {},
      create: { key, tenantId, value: JSON.stringify(initial) },
      select: { value: true },
    })
  }

  const pending: TemplateRun = JSON.parse(row.value)
  if (pending.templateId !== websiteTemplate.id) {
    return { ok: false, code: "WORKSPACE_NOT_EMPTY", message: "Lanjutkan template yang sedang diterapkan atau reset workspace." }
  }
  const busy: ApplyWebsiteTemplateResult = { ok: false, code: "WORKSPACE_NOT_EMPTY", message: "Template sedang diterapkan. Coba lagi setelah proses selesai." }
  if (pending.expiresAt > Date.now()) return busy
  let state: TemplateRun = { ...pending, lease: randomUUID(), expiresAt: Date.now() + APPLY_LEASE_MS }
  let claimedValue = JSON.stringify(state)
  const claimed = await db.setting.updateMany({ where: { key, value: row.value }, data: { value: claimedValue } })
  if (!claimed.count) return busy

  try {
    let imported = 0
    let envVarsApplied: string[] = []
    const templateFiles = websiteTemplate.files as { path: string; content: string; encoding?: "utf-8" | "base64" }[]
    if (state.phase === "schema") {
      const result = await materializeSchemaIntoTenant(tenantDb, tenantId, websiteTemplate.schemaTemplate.schema as any, {}, {
        mergeSingleTypeSlug: SITE_SETTINGS_SLUG,
      })
      imported = result.imported

      const templateEnvVars = await resolveWebsiteTemplateEnvVars(tenantId, tenantSlug, templateFiles)
      if (templateEnvVars.length > 0) {
        const existing = await getTenantCustomEnvVarList(tenantId)
        const merged = new Map(existing.map((variable) => [variable.key, variable]))
        // Explicit environment values may already have been configured by the owner.
        for (const variable of templateEnvVars) {
          if (merged.has(variable.key)) continue
          merged.set(variable.key, variable)
          envVarsApplied.push(variable.key)
        }
        if (envVarsApplied.length) await setTenantCustomEnvVars(tenantId, [...merged.values()])
      }

      const nextState: TemplateRun = { ...state, phase: "deploy" }
      const nextValue = JSON.stringify(nextState)
      const advanced = await db.setting.updateMany({ where: { key, value: claimedValue }, data: { value: nextValue } })
      if (!advanced.count) return busy
      state = nextState
      claimedValue = nextValue
    }

    // Keep each file's encoding so binary assets (logo, fonts) deploy as real bytes.
    const files = templateFiles.map(({ path, content, encoding }) => ({ name: path, content, encoding: encoding ?? "utf-8" as const }))
    const completed = await db.$transaction(async (tx) => {
      const removed = await tx.setting.deleteMany({ where: { key, value: claimedValue } })
      if (!removed.count) return false
      await tx.tenant.update({ where: { id: tenantId }, data: { sourceWebsiteTemplateId: websiteTemplate.id } })
      return tx.mcpDeploymentSource.create({ data: { tenantId, schemaSnapshot: schemaRequirements(websiteTemplate.schemaTemplate.schema), deploymentId: "draft:" + randomUUID(), files, manifest: buildManifest(files) as unknown as object }, select: { id: true } })
    })
    return completed ? { ok: true, imported, envVarsApplied, sourceRevision: completed.id } : busy
  } finally {
    await db.setting.updateMany({
      where: { key, value: claimedValue },
      data: { value: JSON.stringify({ ...state, lease: null, expiresAt: 0 }) },
    }).catch((error) => console.error("[website template] Could not release apply lease:", error))
  }
}
