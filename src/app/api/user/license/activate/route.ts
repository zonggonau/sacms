/**
 * POST /api/user/license/activate
 * Activate an enterprise license key on the CALLER's own ACCOUNT (not a
 * workspace). Unlocks enforceUserPlanLimit()'s "workspaces" bypass — see
 * src/lib/plan-enforcement.ts's `isEnterprise = await isEnterpriseTenant(userId)`
 * fallback, which already checks for exactly this before this route existed
 * to ever populate it, so unlimited-workspace-creation never actually
 * activated for a regular account.
 *
 * No tenant/staff role involved — this only ever touches the caller's own
 * session.user.id, so any authenticated user may call it for themselves.
 */
import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { parseLicenseKey, isLicenseExpired, upsertLicenseCache, getLicenseFromDb } from "@/lib/license"
import { db } from "@/lib/database"
import { apiError, readJson } from "@/lib/api/route-helpers"
import { logAudit, AuditAction } from "@/lib/audit-log"
import { z } from "zod"

export const dynamic = "force-dynamic"

const ActivateSchema = z.object({ licenseKey: z.string().min(1).max(8000) })

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return apiError("unauthorized")

  const body = await readJson(request, ActivateSchema)
  if (!body.ok) return body.response
  const { licenseKey } = body.data

  // 1. Parse & verify RSA signature
  const { payload, error } = parseLicenseKey(licenseKey)
  if (!payload) {
    return apiError("validation", { message: error || "Invalid license key" })
  }

  // 2. Check expiry
  if (isLicenseExpired(payload)) {
    return apiError("validation", { message: "This license key has expired" })
  }

  // 2b. Refuse a key the admin panel has revoked — the RSA signature only
  // proves the key is genuine, not that it's still allowed to be used.
  const dbRecord = await getLicenseFromDb(licenseKey).catch(() => null)
  if (dbRecord?.status === "revoked") {
    return apiError("validation", { message: "This license key has been revoked" })
  }

  // 2c. One license, one account (dbRecord.maxInstances, default 1) — only
  // enforceable for licenses we issued ourselves (dbRecord present). A
  // standalone self-hosted install's LICENSE_KEY env var never calls this
  // route, so instance-wide licenses are unaffected. Re-activating the SAME
  // account is always allowed (e.g. after a cache clear); a DIFFERENT
  // account is rejected once every slot is taken.
  if (dbRecord) {
    const existingActivation = await db.licenseActivation.findUnique({
      where: { licenseId_userId: { licenseId: dbRecord.id, userId: session.user.id } },
    })
    if (!existingActivation) {
      const activationCount = await db.licenseActivation.count({ where: { licenseId: dbRecord.id } })
      if (activationCount >= dbRecord.maxInstances) {
        return apiError("validation", {
          message: "This license key is already in use by another account. Contact SaCMS to raise its account limit.",
        })
      }
      await db.licenseActivation.create({
        data: { licenseId: dbRecord.id, userId: session.user.id, userEmail: session.user.email },
      })
    }
  }

  // 3. Try online validation (optional)
  const licenseServerUrl = process.env.LICENSE_SERVER_URL
  if (licenseServerUrl) {
    try {
      const res = await fetch(`${licenseServerUrl}/api/enterprise/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ licenseKey }),
        signal: AbortSignal.timeout(5000),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        return apiError("validation", {
          message: data.error || "License validation failed on license server",
        })
      }
    } catch {
      console.warn("[License] License server unreachable, activating offline")
    }
  }

  // 4. Cache the license keyed by the user's own id — LicenseCache.id can be
  // any string (tenant id elsewhere, user id here); isEnterpriseTenant(userId)
  // already reads it this way, matching this write.
  // DB value wins when our own admin panel issued this key (lets an admin
  // adjust the storage/AI-credit grant later without reissuing it) — falls
  // back to whatever was actually signed into the key otherwise.
  const storageGb = dbRecord?.storageGb ?? payload.storageGb
  const aiCredits = dbRecord?.aiCredits ?? payload.aiCredits
  const maxWorkspaces = dbRecord?.maxWorkspaces ?? payload.maxWorkspaces

  await upsertLicenseCache({
    valid: true,
    customerName: payload.name,
    customerEmail: payload.email,
    organization: payload.org,
    type: payload.type,
    features: payload.features,
    storageGb,
    aiCredits,
    maxWorkspaces,
    expiresAt: new Date(payload.exp * 1000),
    issuedAt: new Date(payload.iat * 1000),
    daysRemaining: Math.max(0, Math.floor((payload.exp * 1000 - Date.now()) / 86400000)),
    status: "active",
  }, session.user.id, licenseKey)

  // 5. Enterprise accounts get their own dedicated database automatically —
  // every workspace this owner has (now or later) falls back to it via
  // getOwnerMasterInfra() in src/lib/database.ts (User.masterDatabaseUrl),
  // unless the owner later sets up their own BYODB/BYOS at
  // /dashboard/infrastructure instead (which overwrites this field — see
  // PUT /api/user/infrastructure). Never blocks activation itself: a
  // provisioning failure here just leaves the account on the shared DB —
  // but it's surfaced below as `provisioningWarning` instead of only being
  // logged server-side, so the owner isn't left thinking it silently
  // succeeded (confirmed live: the Infrastruktur page's Database tab just
  // looked empty with no explanation).
  let provisioningWarning: string | undefined
  if (payload.type === "enterprise") {
    const existingInfra = await db.user.findUnique({
      where: { id: session.user.id },
      select: { masterDatabaseUrl: true },
    })
    if (!existingInfra?.masterDatabaseUrl) {
      try {
        const { provisionEnterpriseDb } = await import("@/lib/enterprise-db")
        const { invalidateOwnerMasterInfraCache } = await import("@/lib/database")
        const newDbUrl = await provisionEnterpriseDb(session.user.id, "acct")
        await db.user.update({ where: { id: session.user.id }, data: { masterDatabaseUrl: newDbUrl } })
        await invalidateOwnerMasterInfraCache(session.user.id)
        logAudit({
          userId: session.user.id,
          action: AuditAction.SETTINGS_UPDATED,
          entity: "UserMasterInfra",
          data: { autoProvisioned: true },
        })
      } catch (err) {
        console.error("[License] Auto-provisioning a dedicated database failed — account stays on the shared DB:", err)
        logAudit({
          userId: session.user.id,
          action: AuditAction.SETTINGS_UPDATED,
          entity: "UserMasterInfraProvisioningFailed",
          data: { error: err instanceof Error ? err.message : String(err) },
        })
        provisioningWarning =
          "Lisensi aktif, tapi database khusus gagal dibuat otomatis — workspace Anda tetap berjalan di database bersama SaCMS untuk saat ini. Coba lagi nanti atau hubungi support."
      }
    }
  }

  return NextResponse.json({
    success: true,
    message: "License activated successfully",
    customerName: payload.name,
    type: payload.type,
    storageGb,
    aiCredits,
    maxWorkspaces,
    expiresAt: new Date(payload.exp * 1000),
    daysRemaining: Math.max(0, Math.floor((payload.exp * 1000 - Date.now()) / 86400000)),
    ...(provisioningWarning ? { provisioningWarning } : {}),
  })
}
