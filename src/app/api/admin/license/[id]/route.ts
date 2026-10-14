import { NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/lib/database"
import { logAudit, AuditAction } from "@/lib/audit-log"
import { withAdminAuth, apiError, readJson } from "@/lib/api/route-helpers"

const PatchSchema = z.object({ status: z.enum(["active", "revoked"]) })

// PATCH /api/admin/license/[id] - revoke or reactivate a license. Unlike
// DELETE, this is never blocked by the license being in use — revoking the
// one case that most needs it (a leaked/misused key still actively bound
// to a tenant) is the whole point. Checked by validateLicense() /
// the /activate route before trusting a key's RSA signature or cache, so
// this actually cuts off access instead of just hiding the admin-side row.
export const PATCH = withAdminAuth(async (request, context, { session }) => {
  const { id } = await context.params

  const license = await db.enterpriseLicense.findUnique({ where: { id } })
  if (!license) return apiError("not_found", { message: "License not found" })

  const body = await readJson(request, PatchSchema)
  if (!body.ok) return body.response
  const { status } = body.data

  if (license.status === status) {
    return NextResponse.json({ success: true, status })
  }

  const updated = await db.enterpriseLicense.update({ where: { id }, data: { status } })

  logAudit({
    userId: session.user.id,
    action: AuditAction.SETTINGS_UPDATED,
    entity: status === "revoked" ? "EnterpriseLicenseRevoked" : "EnterpriseLicenseReactivated",
    entityId: id,
    data: { customerName: license.customerName, customerEmail: license.customerEmail },
  })

  return NextResponse.json({ success: true, status: updated.status })
})

// GET /api/admin/license/[id] - reveal the full plaintext license key for
// one license on demand (audited). The list endpoint only ever returns a
// truncated displayKey, so the UI's "copy key" action calls this instead.
export const GET = withAdminAuth(async (_req, context, { session }) => {
  const { id } = await context.params

  const license = await db.enterpriseLicense.findUnique({ where: { id } })
  if (!license) return apiError("not_found", { message: "License not found" })

  logAudit({
    userId: session.user.id,
    action: AuditAction.SETTINGS_UPDATED,
    entity: "EnterpriseLicenseRevealed",
    entityId: id,
  })

  return NextResponse.json({ licenseKey: license.licenseKey })
})

export const DELETE = withAdminAuth(async (_req, context, { session }) => {
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

  logAudit({
    userId: session.user.id,
    action: AuditAction.SETTINGS_UPDATED,
    entity: "EnterpriseLicenseDeleted",
    entityId: id,
    data: { customerName: license.customerName, customerEmail: license.customerEmail },
  })

  return NextResponse.json({ success: true, message: "License deleted successfully" })
})
