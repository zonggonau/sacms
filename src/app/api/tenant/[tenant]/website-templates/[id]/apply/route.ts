import { NextResponse } from "next/server"
import { db } from "@/lib/database"
import { withStaffAuth, apiError } from "@/lib/api/route-helpers"
import { canUseWebsiteTemplates, WEBSITE_TEMPLATE_PLAN_MESSAGE } from "@/lib/infrastructure/hosting-plan"
import { applyWebsiteTemplateToTenant } from "@/lib/infrastructure/apply-website-template"

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
  async (_req, context, { access }) => {
    const { id } = await context.params
    const tenant = access.tenant

    const websiteTemplate = await db.websiteTemplate.findUnique({
      where: { id },
      include: { schemaTemplate: true },
    })
    if (!websiteTemplate) return apiError("not_found", { message: "Website Template tidak ditemukan" })
    if (!websiteTemplate.published) {
      return apiError("not_found", { message: "Website Template tidak ditemukan" })
    }

    // Website Templates are a Pro/Business feature (see canUseWebsiteTemplates).
    if (!canUseWebsiteTemplates(tenant.plan)) {
      return apiError("plan_limit", {
        message: WEBSITE_TEMPLATE_PLAN_MESSAGE,
        details: { redirectTo: `/dashboard/${tenant.slug}/subscriptions`, plan: tenant.plan },
      })
    }

    const result = await applyWebsiteTemplateToTenant(tenant.id, tenant.slug, websiteTemplate)
    if (!result.ok) {
      return apiError("validation", { message: result.message })
    }

    return NextResponse.json({
      success: true,
      imported: result.imported,
      envVarsApplied: result.envVarsApplied,
      sourceRevision: result.sourceRevision,
    })
  },
  { minRole: "admin" },
)
