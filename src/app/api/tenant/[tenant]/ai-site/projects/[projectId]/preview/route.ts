import { NextResponse } from "next/server"
import { getTenantDb } from "@/lib/database"
import { withStaffAuth, apiError, handleRouteError } from "@/lib/api/route-helpers"
import { ensurePreview, SandboxConfigError } from "@/lib/ai-site/sandbox"
import { rateLimit } from "@/lib/rate-limit"

export const POST = withStaffAuth(async (_req, context, { access }) => {
  const { projectId } = await context.params
  const tenantDb = await getTenantDb(access.tenant.slug)
  const project = await tenantDb.aiSiteProject.findFirst({
    where: { id: projectId, tenantId: access.tenantId },
    select: { id: true },
  })
  if (!project) return apiError("not_found", { message: "Project not found" })

  // Each call can provision/sync a real Vercel Sandbox — a tight client
  // loop (or a bug in the preview pane) would otherwise run up real
  // Sandbox cost with no credit gate at all, unlike the chat route. Same
  // reasoning as the MCP deploy_to_sacms tool's dedicated cooldown.
  const previewLimit = await rateLimit(`ai_site_preview:${access.tenantId}`, { limit: 20, windowSeconds: 60 })
  if (!previewLimit.success) {
    return apiError("rate_limited", { message: "Too many preview requests. Try again in a moment." })
  }

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
