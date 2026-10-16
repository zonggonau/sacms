import { NextResponse } from "next/server"
import { getTenantDb } from "@/lib/database"
import { withStaffAuth, apiError } from "@/lib/api/route-helpers"
import { listProjectFiles } from "@/lib/ai-site/files"

export const GET = withStaffAuth(async (_req, context, { access }) => {
  const { projectId } = await context.params
  const tenantDb = await getTenantDb(access.tenant.slug)
  const project = await tenantDb.aiSiteProject.findFirst({
    where: { id: projectId, tenantId: access.tenantId },
    select: { id: true },
  })
  if (!project) return apiError("not_found", { message: "Project not found" })

  const files = await listProjectFiles(tenantDb, projectId)
  return NextResponse.json({ files })
}, { minRole: "editor" })
