import { NextResponse } from "next/server"
import { db } from "@/lib/database"
import { validateBody } from "@/lib/validate"
import { withStaffAuth, apiError } from "@/lib/api/route-helpers"
import { addWorkspaceStaff, addWorkspaceStaffSchema, workspaceStaffUserSelect, WorkspaceStaffError } from "@/lib/workspace-staff"

export const GET = withStaffAuth(async (_request, _context, { access }) => {
  const members = await db.tenantMember.findMany({
    where: { tenantId: access.tenantId },
    include: { user: { select: workspaceStaffUserSelect } },
    orderBy: { joinedAt: "asc" },
  })
  return NextResponse.json({ members })
})

export const POST = withStaffAuth(
  async (request, _context, { access, session }) => {
    const result = await validateBody(request, addWorkspaceStaffSchema)
    if ("error" in result) return result.error
    try {
      return NextResponse.json(await addWorkspaceStaff(access.tenantId, session.user, result.data))
    } catch (error) {
      if (!(error instanceof WorkspaceStaffError)) throw error
      return apiError(error.code, { message: error.message, details: error.details })
    }
  },
  { minRole: "admin" },
)
