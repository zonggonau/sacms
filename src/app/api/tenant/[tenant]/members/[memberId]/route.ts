import { NextResponse } from "next/server"
import { validateBody } from "@/lib/validate"
import { withStaffAuth, apiError } from "@/lib/api/route-helpers"
import { removeWorkspaceStaff, updateWorkspaceStaff, updateWorkspaceStaffSchema, WorkspaceStaffError } from "@/lib/workspace-staff"

export const PATCH = withStaffAuth(
  async (request, context, { access, session }) => {
    const { memberId } = await context.params
    const result = await validateBody(request, updateWorkspaceStaffSchema)
    if ("error" in result) return result.error
    try {
      await updateWorkspaceStaff(access.tenantId, session.user, memberId, result.data)
      return NextResponse.json({ success: true })
    } catch (error) {
      if (!(error instanceof WorkspaceStaffError)) throw error
      return apiError(error.code, { message: error.message })
    }
  },
  { minRole: "admin" },
)

export const DELETE = withStaffAuth(
  async (_request, context, { access, session }) => {
    const { memberId } = await context.params
    try {
      await removeWorkspaceStaff(access.tenantId, session.user, memberId)
      return NextResponse.json({ success: true })
    } catch (error) {
      if (!(error instanceof WorkspaceStaffError)) throw error
      return apiError(error.code, { message: error.message })
    }
  },
  { minRole: "admin" },
)
