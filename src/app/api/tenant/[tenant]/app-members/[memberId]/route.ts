import { NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/lib/database"
import { hashMemberPassword } from "@/lib/member-auth"
import { withStaffAuth, apiError, readJson } from "@/lib/api/route-helpers"

const MEMBER_FIELDS = {
  id: true, email: true, name: true, avatar: true, role: true, status: true,
  metadata: true, createdAt: true, updatedAt: true, lastLoginAt: true, emailVerified: true,
} as const

const UpdateSchema = z.object({
  name: z.string().min(1).optional(),
  role: z.string().optional(),
  status: z.enum(["active", "suspended", "pending_verification"]).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  password: z.string().min(8).optional(),
})

export const GET = withStaffAuth(async (_request, context, { access }) => {
  const { memberId } = await context.params
  const member = await db.member.findFirst({
    where: { id: memberId, tenantId: access.tenantId },
    select: MEMBER_FIELDS,
  })
  if (!member) return apiError("not_found", { message: "Member not found" })
  return NextResponse.json({ member })
})

export const PATCH = withStaffAuth(
  async (request, context, { access }) => {
    const { memberId } = await context.params
    const member = await db.member.findFirst({ where: { id: memberId, tenantId: access.tenantId } })
    if (!member) return apiError("not_found", { message: "Member not found" })

    const body = await readJson(request, UpdateSchema)
    if (!body.ok) return body.response

    const { password, ...rest } = body.data
    const data: Record<string, unknown> = { ...rest }
    if (password) data.passwordHash = await hashMemberPassword(password)

    const updated = await db.member.update({
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
    const member = await db.member.findFirst({ where: { id: memberId, tenantId: access.tenantId } })
    if (!member) return apiError("not_found", { message: "Member not found" })

    await db.member.delete({ where: { id: memberId } })
    return NextResponse.json({ ok: true })
  },
  { minRole: "admin" },
)
