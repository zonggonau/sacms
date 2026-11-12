import { NextResponse } from "next/server"
import { db, getTenantDb } from "@/lib/database"
import { withStaffAuth, apiError } from "@/lib/api/route-helpers"
import { isTenantPlanPaid } from "@/lib/infrastructure/hosting-plan"
import { materializeSchemaIntoTenant } from "@/lib/schema-template-sync"
import { deployTenantFrontend } from "@/lib/infrastructure/deploy-frontend"
import {
  resolveApiOrigin,
  resolveWebsiteTemplateEnvVars,
  getTenantCustomEnvVarList,
  setTenantCustomEnvVars,
} from "@/lib/infrastructure/frontend-env"

/**
 * POST /api/tenant/[tenant]/website-templates/[id]/apply
 *
 * "Terapkan" — materializes the Website Template's linked Schema Template
 * into this workspace's real Content Types/Single Types/Components, then
 * deploys the Website Template's bundled frontend files to this workspace's
 * SaCMS Cloud Hosting project. The dashboard's review dialog (file list +
 * content) is shown BEFORE this is ever called — this endpoint performs the
 * actual apply, not the preview (see GET .../website-templates/[id] for that).
 */
export const POST = withStaffAuth(
  async (_req, context, { access, session }) => {
    const { id } = await context.params
    const tenant = access.tenant

    const websiteTemplate = await db.websiteTemplate.findUnique({
      where: { id },
      include: { schemaTemplate: true },
    })
    if (!websiteTemplate) return apiError("not_found", { message: "Website Template tidak ditemukan" })
    if (!access.isGlobal && !websiteTemplate.published) {
      return apiError("not_found", { message: "Website Template tidak ditemukan" })
    }

    // Billing gate — this ends in a real hosting deploy, same gate as
    // ai-builder/deploy's own `action === "deploy"`.
    const isPaid = isTenantPlanPaid(tenant.plan) || session.user.role === "super_admin"
    if (!isPaid) {
      return apiError("plan_limit", {
        message: "Menerapkan Website Template memerlukan paket berbayar. Upgrade paket Anda untuk melanjutkan.",
        details: { redirectTo: `/dashboard/${tenant.slug}/subscriptions`, plan: tenant.plan },
      })
    }

    // Empty-workspace guard — same convention as "Pakai Template"'s
    // requireEmpty check in ai-builder/import-schema/route.ts. A Website
    // Template's schema is tied to its own specific Schema Template, so
    // applying it on top of unrelated existing structures would silently
    // skip slug-conflicting models and leave a confusing mix behind.
    const tenantDb = await getTenantDb(tenant.slug)
    const [hasCt, hasSt, hasComp] = await Promise.all([
      tenantDb.contentType.findFirst({ where: { tenantId: tenant.id }, select: { id: true } }),
      tenantDb.singleType.findFirst({ where: { tenantId: tenant.id }, select: { id: true } }),
      tenantDb.component.findFirst({ where: { tenantId: tenant.id }, select: { id: true } }),
    ])
    if (hasCt || hasSt || hasComp) {
      return apiError("validation", {
        message: "Masih ada Content Type/Single Type/Component di workspace ini. Hapus dulu (tombol \"Hapus Semua Schema\") sebelum menerapkan Website Template.",
      })
    }

    const { imported } = await materializeSchemaIntoTenant(
      tenantDb,
      tenant.id,
      websiteTemplate.schemaTemplate.schema as any,
    )

    // Pre-populate the Environment tab with whatever custom vars the
    // bundled frontend expects — resolved to this workspace's REAL
    // production API origin/tenant slug/deploy token wherever the
    // template's .env(.example) used a {{SACMS_*}} placeholder — BEFORE
    // deploying, so the very first deploy (and every Redeploy after it)
    // already carries correct values instead of the customer having to
    // discover and fill them in by hand after the fact.
    const templateFiles = websiteTemplate.files as unknown as { path: string; content: string }[]
    const templateEnvVars = await resolveWebsiteTemplateEnvVars(tenant.id, tenant.slug, templateFiles)
    if (templateEnvVars.length > 0) {
      const existing = await getTenantCustomEnvVarList(tenant.id)
      const merged = [...existing]
      for (const v of templateEnvVars) {
        const idx = merged.findIndex((m) => m.key === v.key)
        if (idx >= 0) merged[idx] = v
        else merged.push(v)
      }
      await setTenantCustomEnvVars(tenant.id, merged)
    }

    const files = templateFiles.map((f) => ({ name: f.path, content: f.content }))
    const deployResult = await deployTenantFrontend(tenant.id, tenant.slug, resolveApiOrigin(), files)

    return NextResponse.json({
      success: true,
      imported,
      envVarsApplied: templateEnvVars.map((v) => v.key),
      deployment: deployResult,
    })
  },
  { minRole: "admin" },
)
