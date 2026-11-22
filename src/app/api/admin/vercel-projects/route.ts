import { NextResponse } from "next/server"
import { db } from "@/lib/database"
import { logAudit, AuditAction } from "@/lib/audit-log"
import { withAdminAuth, apiError } from "@/lib/api/route-helpers"
import { listVercelProjectsDetailed, deleteVercelProject, isVercelConfigured, getProjectPrimaryDomain } from "@/lib/vercel-client"

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

  const enriched = await Promise.all(projects.map(async (p) => {
    const tenant = tenantByProjectId.get(p.id) || null
    // Orphaned projects (no owning tenant row — typically an internal demo
    // workspace from Website/Schema Template previews) never get a
    // Tenant.vercelDeploymentUrl written anywhere, since deployWebsiteTemplateDemo
    // persists the resolved URL onto WebsiteTemplate.demoUrl instead of any
    // Tenant row. listVercelProjectsDetailed's own `url` field is only a
    // crude fallback (the project's first raw alias, or — when no alias
    // exists yet — the current deployment's own unstable, random-hash
    // preview URL, e.g. "my-project-ab12cd34.vercel.app"), so resolve the
    // same way getProjectPrimaryDomain already does for a real tenant
    // (preferring a verified custom/sacms.cloud domain) before falling back
    // to that raw value. Skipped for tenant-linked projects to avoid one
    // extra Vercel API call per row when the tenant's own stored URL is
    // already authoritative.
    const resolvedUrl = tenant?.vercelDeploymentUrl || (!tenant ? await getProjectPrimaryDomain(p.id) : null) || p.url
    return {
      ...p,
      url: resolvedUrl,
      tenant: tenant ? { id: tenant.id, name: tenant.name, slug: tenant.slug } : null,
    }
  }))

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
