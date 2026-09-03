import { NextResponse } from "next/server"
import { hashPassword } from "@/lib/auth"
import { db } from "@/lib/database"
import { validateBody } from "@/lib/validate"
import { z } from "zod/v4"
import { withStaffAuth, apiError } from "@/lib/api/route-helpers"
import { STAFF_ROLES, roleMeets, type StaffRole } from "@/lib/rbac/staff"

const updateMemberSchema = z.object({
  role: z.enum(STAFF_ROLES).optional(),
  password: z.string().min(8).optional(),
})

export const PATCH = withStaffAuth(
  async (request, context, { access, session }) => {
    const { memberId } = await context.params

    const result = await validateBody(request, updateMemberSchema)
    if ("error" in result) return result.error
    const { role, password } = result.data

    const member = await db.tenantMember.findUnique({ where: { id: memberId }, include: { user: true } })
    if (!member || member.tenantId !== access.tenantId) {
      return apiError("not_found", { message: "Member not found" })
    }

    if (role) {
      // You can't set a role higher than your own (super_admin bypasses this).
      const isSuperAdmin = session.user.role === "super_admin"
      if (!isSuperAdmin && roleMeets(role, access.role as StaffRole) && role !== access.role) {
        return apiError("forbidden", { message: "You cannot assign a role higher than your own" })
      }
      if (member.userId === session.user.id && role !== member.role) {
        return apiError("forbidden", { message: "You cannot change your own role" })
      }
      if (member.role === "owner" && role !== "owner") {
        const ownerCount = await db.tenantMember.count({ where: { tenantId: access.tenantId, role: "owner" } })
        if (ownerCount <= 1) return apiError("validation", { message: "Cannot change the only owner's role" })
      }
      await db.tenantMember.update({ where: { id: memberId }, data: { role } })
    }

    if (password) {
      await db.user.update({ where: { id: member.userId }, data: { password: await hashPassword(password) } })
    }

    return NextResponse.json({ success: true })
  },
  { minRole: "admin" },
)

export const DELETE = withStaffAuth(
  async (_request, context, { access, session }) => {
    const { memberId } = await context.params

    const member = await db.tenantMember.findUnique({ where: { id: memberId } })
    if (!member || member.tenantId !== access.tenantId) {
      return apiError("not_found", { message: "Member not found" })
    }
    if (member.userId === session.user.id) {
      return apiError("validation", { message: "You cannot remove yourself" })
    }
    if (member.role === "owner") {
      const ownerCount = await db.tenantMember.count({ where: { tenantId: access.tenantId, role: "owner" } })
      if (ownerCount <= 1) return apiError("validation", { message: "Cannot remove the only owner" })
    }

    await db.tenantMember.delete({ where: { id: memberId } })
    return NextResponse.json({ success: true })
  },
  { minRole: "admin" },
)
