import { NextResponse } from "next/server"
import { z } from "zod"
import { getTenantDbById, Prisma } from "@/lib/database"
import { invalidatePermissionCache } from "@/lib/permissions-engine"
import { withStaffAuth, apiError, readJson } from "@/lib/api/route-helpers"

const PermissionsSchema = z.object({
  permissions: z.array(z.object({
    contentTypeSlug: z.string().min(1),
    action: z.enum(["find", "findOne", "create", "update", "delete"]),
    granted: z.boolean().default(true),
    conditions: z.record(z.string(), z.unknown()).optional(),
  })),
})

export const GET = withStaffAuth(async (_request, context, { access }) => {
  const { roleId } = await context.params
  const tenantDb = await getTenantDbById(access.tenantId)
  const role = await tenantDb.memberRole.findFirst({
    where: { id: roleId, tenantId: access.tenantId },
    select: {
      permissions: { orderBy: [{ contentTypeSlug: "asc" }, { action: "asc" }] },
    },
  })
  if (!role) return apiError("not_found", { message: "Role not found" })
  return NextResponse.json({ permissions: role.permissions })
})

/** PUT replaces the entire permission set for a role (idempotent matrix save). */
export const PUT = withStaffAuth(
  async (request, context, { access }) => {
    const { roleId } = await context.params
    const tenantDb = await getTenantDbById(access.tenantId)
    const body = await readJson(request, PermissionsSchema)
    if (!body.ok) return body.response
    const { permissions } = body.data
    const keys = new Set(permissions.map(({ contentTypeSlug, action }) => JSON.stringify([contentTypeSlug, action])))
    if (keys.size !== permissions.length) return apiError("validation", { message: "Each permission may appear only once" })

    const role = await tenantDb.$transaction(async (tx) => {
      // Concurrent saves for one role must serialize the whole replacement.
      const [lockedRole] = await tx.$queryRaw<Array<{ slug: string }>>`
        SELECT slug FROM "member_roles" WHERE id = ${roleId} AND "tenantId" = ${access.tenantId} FOR UPDATE
      `
      if (!lockedRole) return null
      await tx.memberRolePermission.deleteMany({ where: { memberRoleId: roleId } })
      if (permissions.length > 0) {
        await tx.memberRolePermission.createMany({
          data: permissions.map(({ contentTypeSlug, action, granted, conditions }) => ({
            memberRoleId: roleId,
            contentTypeSlug,
            action,
            granted,
            conditions: (conditions ?? Prisma.DbNull) as Prisma.InputJsonValue | typeof Prisma.DbNull,
          })),
        })
      }
      return lockedRole
    })
    if (!role) return apiError("not_found", { message: "Role not found" })

    await invalidatePermissionCache(access.tenantId, role.slug)
    return NextResponse.json({ ok: true, count: permissions.length })
  },
  { minRole: "admin" },
)
