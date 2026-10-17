import { NextResponse } from "next/server"
import { getTenantDb } from "@/lib/database"
import { withStaffAuth, apiError, handleRouteError } from "@/lib/api/route-helpers"
import { ensurePreview, SandboxConfigError } from "@/lib/ai-site/sandbox"

export const POST = withStaffAuth(async (_req, context, { access }) => {
  const { projectId } = await context.params
  const tenantDb = await getTenantDb(access.tenant.slug)
  const project = await tenantDb.aiSiteProject.findFirst({
    where: { id: projectId, tenantId: access.tenantId },
    select: { id: true },
  })
  if (!project) return apiError("not_found", { message: "Project not found" })

  try {
    const { url } = await ensurePreview(tenantDb, access.tenantId, access.tenant.slug, projectId)
    return NextResponse.json({ url })
  } catch (error) {
    if (error instanceof SandboxConfigError) {
      return apiError("validation", { message: error.message, status: 503 })
    }
    return handleRouteError(error, { route: "ai-site/preview", method: "POST" })
  }
}, { minRole: "editor" })
