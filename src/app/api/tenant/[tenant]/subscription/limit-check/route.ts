import { enforcePlanLimit, WorkspaceResource } from "@/lib/plan-enforcement"
import { NextResponse } from "next/server"
import { withStaffAuth } from "@/lib/api/route-helpers"

export const GET = withStaffAuth(async (request, _context, { access, session }) => {
  const feature = (request.nextUrl.searchParams.get("feature") || "content_entries") as WorkspaceResource
  const result = await enforcePlanLimit(access.tenantId, feature, session.user.id)

  return NextResponse.json({
    allowed: result.allowed,
    current: result.current,
    max: result.max,
    message: result.message,
    planSlug: result.planSlug,
  })
})
