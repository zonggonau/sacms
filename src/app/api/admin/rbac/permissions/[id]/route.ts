import { NextResponse } from "next/server"
import { db } from "@/lib/database"
import { validateBody } from "@/lib/validate"
import { updatePermissionSchema } from "@/lib/validations"
import { withAdminAuth, apiError } from "@/lib/api/route-helpers"

export const PATCH = withAdminAuth(
  async (request, context) => {
    const { id } = await context.params
    const result = await validateBody(request, updatePermissionSchema)
    if ("error" in result) return result.error
    const data = result.data

    if (data.name) {
      const existing = await db.permission.findUnique({ where: { name: data.name } })
      if (existing && existing.id !== id) {
        return apiError("conflict", { message: "Permission with this name already exists" })
      }
    }

    const permission = await db.permission.update({ where: { id }, data })
    return NextResponse.json({ permission })
  },
  { allowRoles: ["admin"] },
)

export const DELETE = withAdminAuth(
  async (_request, context) => {
    const { id } = await context.params
    await db.rolePermission.deleteMany({ where: { permissionId: id } })
    await db.permission.delete({ where: { id } })
    return NextResponse.json({ success: true })
  },
  { allowRoles: ["admin"] },
)
