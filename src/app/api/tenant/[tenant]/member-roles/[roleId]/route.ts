import { NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/lib/database"
import { invalidatePermissionCache } from "@/lib/permissions-engine"
import { withStaffAuth, apiError, readJson } from "@/lib/api/route-helpers"

const UpdateSchema = z.object({
  name: z.string().min(1).max(60).trim().optional(),
  description: z.string().optional(),
})

export const GET = withStaffAuth(async (_request, context, { access }) => {
  const { roleId } = await context.params
  const role = await db.memberRole.findFirst({
    where: { id: roleId, tenantId: access.tenantId },
    include: { permissions: { orderBy: [{ contentTypeSlug: "asc" }, { action: "asc" }] } },
  })
  if (!role) return apiError("not_found", { message: "Role not found" })
  return NextResponse.json({ role })
})

export const PATCH = withStaffAuth(
  async (request, context, { access }) => {
    const { roleId } = await context.params
    const role = await db.memberRole.findFirst({ where: { id: roleId, tenantId: access.tenantId } })
    if (!role) return apiError("not_found", { message: "Role not found" })
    if (role.isSystem) return apiError("forbidden", { message: "System roles cannot be renamed" })

    const body = await readJson(request, UpdateSchema)
    if (!body.ok) return body.response

    const updated = await db.memberRole.update({ where: { id: roleId }, data: body.data })
    await invalidatePermissionCache(access.tenantId, role.slug)
    return NextResponse.json({ role: updated })
  },
  { minRole: "admin" },
)

export const DELETE = withStaffAuth(
  async (_request, context, { access }) => {
    const { roleId } = await context.params
    const role = await db.memberRole.findFirst({ where: { id: roleId, tenantId: access.tenantId } })
    if (!role) return apiError("not_found", { message: "Role not found" })
    if (role.isSystem) return apiError("forbidden", { message: "System roles cannot be deleted" })

    await db.memberRole.delete({ where: { id: roleId } })
    await invalidatePermissionCache(access.tenantId, role.slug)
    return NextResponse.json({ ok: true })
  },
  { minRole: "admin" },
)
