import { NextResponse } from "next/server"
import { z } from "zod"
import { db, getTenantDbById } from "@/lib/database"
import { hashMemberPassword } from "@/lib/member-auth"
import { withStaffAuth, apiError, readJson } from "@/lib/api/route-helpers"

const MEMBER_FIELDS = {
  id: true, email: true, name: true, avatar: true, role: true, status: true,
  metadata: true, createdAt: true, updatedAt: true, lastLoginAt: true, emailVerified: true,
} as const

const UpdateSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  role: z.string().regex(/^[a-z0-9-]{1,60}$/, "role must be a lowercase slug").optional(),
  status: z.enum(["active", "suspended", "pending_verification"]).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  password: z.string().min(8).max(128).optional(),
})

export const GET = withStaffAuth(async (_request, context, { access }) => {
  const { memberId } = await context.params
  const tenantDb = await getTenantDbById(access.tenantId)
  const member = await tenantDb.member.findFirst({
    where: { id: memberId, tenantId: access.tenantId },
    select: MEMBER_FIELDS,
  })
  if (!member) return apiError("not_found", { message: "Member not found" })
  return NextResponse.json({ member })
})

export const PATCH = withStaffAuth(
  async (request, context, { access }) => {
    const { memberId } = await context.params
    const tenantDb = await getTenantDbById(access.tenantId)
    const member = await tenantDb.member.findFirst({ where: { id: memberId, tenantId: access.tenantId } })
    if (!member) return apiError("not_found", { message: "Member not found" })

    const body = await readJson(request, UpdateSchema)
    if (!body.ok) return body.response

    const { password, ...rest } = body.data
    // A role, if given, must be one this tenant actually defines.
    if (rest.role !== undefined) {
      const known = await db.memberRole.findFirst({
        where: { tenantId: access.tenantId, slug: rest.role },
        select: { id: true },
      })
      if (!known) return apiError("validation", { message: `Unknown member role: ${rest.role}` })
    }
    const data: Record<string, unknown> = { ...rest }
    if (password) data.passwordHash = await hashMemberPassword(password)

    const updated = await tenantDb.member.update({
      where: { id: memberId },
      data,
      select: { id: true, email: true, name: true, avatar: true, role: true, status: true, metadata: true, createdAt: true, updatedAt: true },
    })
    return NextResponse.json({ member: updated })
  },
  { minRole: "admin" },
)

export const DELETE = withStaffAuth(
  async (_request, context, { access }) => {
    const { memberId } = await context.params
    const tenantDb = await getTenantDbById(access.tenantId)
    const member = await tenantDb.member.findFirst({ where: { id: memberId, tenantId: access.tenantId } })
    if (!member) return apiError("not_found", { message: "Member not found" })

    await tenantDb.member.delete({ where: { id: memberId } })
    return NextResponse.json({ ok: true })
  },
  { minRole: "admin" },
)
