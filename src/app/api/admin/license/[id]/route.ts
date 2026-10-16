import { NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/lib/database"
import { logAudit, AuditAction } from "@/lib/audit-log"
import { withAdminAuth, apiError, readJson } from "@/lib/api/route-helpers"

const PatchSchema = z.object({
  status: z.enum(["active", "revoked"]).optional(),
  // Lets an admin raise/lower an account-level license's pooled storage /
  // AI-credit grant (see getOwnerStorageLicense()/getUserAiCreditLicense()
  // in plan-enforcement.ts) WITHOUT reissuing the signed key —
  // validateLicense() prefers this DB value over whatever was originally
  // signed into the key. null clears it back to whatever the key itself grants.
  storageGb: z.number().int().positive().nullable().optional(),
  aiCredits: z.number().int().positive().nullable().optional(),
  // How many distinct accounts may hold this license — see
  // EnterpriseLicense.maxInstances. Not nullable (unlike storageGb/aiCredits):
  // there's no "no limit" state, it just goes back to the default of 1.
  maxInstances: z.number().int().positive().optional(),
}).refine((data) => data.status !== undefined || data.storageGb !== undefined || data.aiCredits !== undefined || data.maxInstances !== undefined, {
  message: "Provide at least one of status, storageGb, aiCredits, or maxInstances",
})

// PATCH /api/admin/license/[id] - revoke/reactivate a license, and/or adjust
// its pooled storage grant. Unlike DELETE, revoking is never blocked by the
// license being in use — revoking the one case that most needs it (a
// leaked/misused key still actively bound to a tenant) is the whole point.
// Checked by validateLicense() / the /activate routes before trusting a
// key's RSA signature or cache, so this actually cuts off access instead of
// just hiding the admin-side row.
export const PATCH = withAdminAuth(async (request, context, { session }) => {
  const { id } = await context.params

  const license = await db.enterpriseLicense.findUnique({ where: { id } })
  if (!license) return apiError("not_found", { message: "License not found" })

  const body = await readJson(request, PatchSchema)
  if (!body.ok) return body.response
  const { status, storageGb, aiCredits, maxInstances } = body.data

  const data: { status?: string; storageGb?: number | null; aiCredits?: number | null; maxInstances?: number } = {}
  if (status !== undefined && status !== license.status) data.status = status
  if (storageGb !== undefined && storageGb !== license.storageGb) data.storageGb = storageGb
  if (aiCredits !== undefined && aiCredits !== license.aiCredits) data.aiCredits = aiCredits
  if (maxInstances !== undefined && maxInstances !== license.maxInstances) data.maxInstances = maxInstances

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ success: true, status: license.status, storageGb: license.storageGb, aiCredits: license.aiCredits, maxInstances: license.maxInstances })
  }

  const updated = await db.enterpriseLicense.update({ where: { id }, data })

  // validateLicense()'s Step 1 returns a warm LicenseCache row as-is without
  // re-checking the DB — without clearing it, whoever activated this key
  // would keep seeing the OLD status/storageGb/aiCredits until their cache
  // happened to be rebuilt some other way. Same cache-busting need as the
  // standalone license-check cron (see src/app/api/cron/license-check/route.ts).
  await db.licenseCache.deleteMany({ where: { licenseKey: license.licenseKey } }).catch(() => {})

  logAudit({
    userId: session.user.id,
    action: AuditAction.SETTINGS_UPDATED,
    entity: data.status ? (data.status === "revoked" ? "EnterpriseLicenseRevoked" : "EnterpriseLicenseReactivated") : "EnterpriseLicenseQuotaAdjusted",
    entityId: id,
    data: { customerName: license.customerName, customerEmail: license.customerEmail, ...data },
  })

  return NextResponse.json({ success: true, status: updated.status, storageGb: updated.storageGb, aiCredits: updated.aiCredits, maxInstances: updated.maxInstances })
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
