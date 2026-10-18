import { NextResponse } from "next/server"
import { getTenantDb } from "@/lib/database"
import { withStaffAuth, apiError } from "@/lib/api/route-helpers"
import { isTenantPlanPaid } from "@/lib/infrastructure/hosting-plan"
import { deployTenantFrontend } from "@/lib/infrastructure/deploy-frontend"
import { listProjectFiles } from "@/lib/ai-site/files"

export const maxDuration = 120

/**
 * Publishes the project's current files to the tenant's real Vercel
 * deployment — the exact same one-project-per-tenant target the
 * dashboard's own one-click-deploy (ai-builder/deploy) already uses, via
 * the shared deployTenantFrontend(). The existing domain-management UI at
 * /infrastructure already works for whatever lands here; no separate
 * domain UI needed inside AI Site.
 */
export const POST = withStaffAuth(async (req, context, { access, session }) => {
  const tenant = access.tenant

  const isPaid = isTenantPlanPaid(tenant.plan) || session.user.role === "super_admin"
  if (!isPaid) {
    return apiError("plan_limit", {
      message: "Publish ke hosting produksi memerlukan paket berbayar. Upgrade paket Anda untuk melanjutkan.",
      details: { redirectTo: `/dashboard/${tenant.slug}/subscriptions`, plan: tenant.plan },
    })
  }

  const { projectId } = await context.params
  const tenantDb = await getTenantDb(tenant.slug)
  const project = await tenantDb.aiSiteProject.findFirst({
    where: { id: projectId, tenantId: access.tenantId },
  })
  if (!project) return apiError("not_found", { message: "Project not found" })

  const files = await listProjectFiles(tenantDb, projectId)
  if (files.length === 0) {
    return apiError("validation", { message: "Belum ada file untuk dipublish — generate frontend-nya dulu di chat." })
  }

  const origin = req.nextUrl.origin
  const result = await deployTenantFrontend(
    access.tenantId,
    tenant.slug,
    origin,
    files.map((f) => ({ name: f.path, content: f.content })),
  )

  return NextResponse.json({ success: true, ...result })
}, { minRole: "admin" })
