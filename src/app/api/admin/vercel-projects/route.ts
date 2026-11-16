import { NextResponse } from "next/server"
import { db } from "@/lib/database"
import { logAudit, AuditAction } from "@/lib/audit-log"
import { withAdminAuth, apiError } from "@/lib/api/route-helpers"
import { listVercelProjectsDetailed, deleteVercelProject, isVercelConfigured } from "@/lib/vercel-client"

/**
 * Admin-only read of every Vercel project on the configured account/team,
 * cross-referenced against which tenant (if any) owns it via
 * `Tenant.vercelProjectId`. A project with no matching tenant is "orphaned"
 * — e.g. a demo deployment, or a tenant whose Vercel link was cleared
 * without the project itself being deleted on Vercel's side.
 */
export const GET = withAdminAuth(async () => {
  const configured = await isVercelConfigured()
  if (!configured) {
    return NextResponse.json({ configured: false, projects: [], total: 0, orphanedCount: 0 })
  }

  const projects = await listVercelProjectsDetailed()
  const tenants = await db.tenant.findMany({
    where: { vercelProjectId: { in: projects.map((p) => p.id) } },
    select: { id: true, name: true, slug: true, vercelProjectId: true, vercelDeploymentUrl: true },
  })
  const tenantByProjectId = new Map(tenants.map((t) => [t.vercelProjectId as string, t]))

  const enriched = projects.map((p) => {
    const tenant = tenantByProjectId.get(p.id) || null
    return {
      ...p,
      // Prefer the tenant's own stored production URL (already resolved by
      // getProjectPrimaryDomain to the sacms.cloud-branded/custom domain,
      // not Vercel's raw project alias) — same link the tenant's own
      // dashboard shows for this deployment, so admin and tenant never see
      // two different "live" URLs for the same project.
      url: tenant?.vercelDeploymentUrl || p.url,
      tenant: tenant ? { id: tenant.id, name: tenant.name, slug: tenant.slug } : null,
    }
  })

  return NextResponse.json({
    configured: true,
    projects: enriched,
    total: enriched.length,
    orphanedCount: enriched.filter((p) => !p.tenant).length,
  })
})

export const DELETE = withAdminAuth(async (request, _context, { session }) => {
  const id = new URL(request.url).searchParams.get("id")
  const name = new URL(request.url).searchParams.get("name") || ""
  if (!id) return apiError("validation", { message: "Project ID is required" })

  const result = await deleteVercelProject(id)
  if (!result.ok) {
    return apiError("validation", { message: result.error || "Gagal menghapus project di Vercel" })
  }

  // A deleted project may still be linked from a tenant row (and the
  // legacy per-tenant Setting keys mirroring it) — clear both so the
  // dashboard doesn't keep pointing at a project that no longer exists.
  const tenant = await db.tenant.findFirst({ where: { vercelProjectId: id }, select: { id: true } })
  if (tenant) {
    await Promise.all([
      db.tenant.update({
        where: { id: tenant.id },
        data: { vercelDeploymentUrl: null, vercelProjectId: null, customDomain: null },
      }).catch((err) => console.warn("Failed to clear tenant vercel fields after admin delete:", err)),
      db.setting.deleteMany({
        where: {
          key: {
            in: [`${tenant.id}_vercelDeploymentUrl`, `${tenant.id}_vercelProjectId`, `${tenant.id}_customDomain`],
          },
        },
      }).catch(() => null),
    ])
  }

  logAudit({
    userId: session.user.id,
    action: AuditAction.VERCEL_PROJECT_DELETED,
    entity: "VercelProject",
    entityId: id,
    tenantId: tenant?.id,
    data: { projectId: id, projectName: name },
  })

  return NextResponse.json({ success: true })
})
