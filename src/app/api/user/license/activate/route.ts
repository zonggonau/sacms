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
import { apiError, readJson } from "@/lib/api/route-helpers"
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
  // adjust the storage grant later without reissuing it) — falls back to
  // whatever was actually signed into the key otherwise.
  const storageGb = dbRecord?.storageGb ?? payload.storageGb

  await upsertLicenseCache({
    valid: true,
    customerName: payload.name,
    customerEmail: payload.email,
    organization: payload.org,
    type: payload.type,
    features: payload.features,
    storageGb,
    expiresAt: new Date(payload.exp * 1000),
    issuedAt: new Date(payload.iat * 1000),
    daysRemaining: Math.max(0, Math.floor((payload.exp * 1000 - Date.now()) / 86400000)),
    status: "active",
  }, session.user.id, licenseKey)

  return NextResponse.json({
    success: true,
    message: "License activated successfully",
    customerName: payload.name,
    type: payload.type,
    storageGb,
    expiresAt: new Date(payload.exp * 1000),
    daysRemaining: Math.max(0, Math.floor((payload.exp * 1000 - Date.now()) / 86400000)),
  })
}
