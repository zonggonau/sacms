import { NextResponse } from "next/server"
import { db } from "@/lib/database"
import { withAdminAuth, apiError } from "@/lib/api/route-helpers"

export const DELETE = withAdminAuth(
  async (_req, context) => {
    const { id } = await context.params

    const license = await db.enterpriseLicense.findUnique({ where: { id } })
    if (!license) return apiError("not_found", { message: "License not found" })

    const [usedInCache, usedInTenant] = await Promise.all([
      db.licenseCache.findFirst({ where: { licenseKey: license.licenseKey } }),
      db.tenant.findFirst({ where: { licenseKey: license.licenseKey } }),
    ])
    if (usedInCache || usedInTenant) {
      return apiError("conflict", {
        message:
          "Cannot delete this license because it is currently in use by one or more users or workspaces.",
      })
    }

    await db.enterpriseLicense.delete({ where: { id } })
    return NextResponse.json({ success: true, message: "License deleted successfully" })
  },
  { allowRoles: ["admin", "employee", "karyawan"] },
)
