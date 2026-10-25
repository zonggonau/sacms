/**
 * GET /api/user/license/status
 * Current enterprise license status for the CALLER's own ACCOUNT (not a
 * workspace) — mirrors /api/tenant/[tenant]/license/status's logic exactly,
 * scoped to session.user.id instead of a tenant id. Any authenticated user
 * may check their own status; no tenant/staff role involved.
 */
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getCachedLicense, validateLicense, parseLicenseKey } from "@/lib/license"
import { getOwnerPooledStorageUsedBytes } from "@/lib/plan-enforcement"
import { db } from "@/lib/database"
import { apiError } from "@/lib/api/route-helpers"

export const dynamic = "force-dynamic"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return apiError("unauthorized")

  const userId = session.user.id
  try {
    let license = await getCachedLicense(userId)

    if (!license || !license.valid) {
      license = await validateLicense(userId)
    }

    if (!license || !license.valid) {
      return NextResponse.json({
        valid: false,
        status: license?.status || "no_license",
        error: license?.error || "No license key configured.",
        customerName: license?.customerName,
        type: license?.type,
        expiresAt: license?.expiresAt,
        issuedAt: license?.issuedAt,
      })
    }

    const cachedRecord = await db.licenseCache.findUnique({
      where: { id: userId },
    })
    const keyToParse = cachedRecord?.licenseKey || ""

    let totalDays = 365
    if (keyToParse) {
      try {
        const { payload } = parseLicenseKey(keyToParse)
        if (payload) {
          totalDays = Math.round((payload.exp - payload.iat) / 86400)
        }
      } catch (e) {
        console.warn("Failed to parse license key iat/exp:", e)
      }
    }

    // Pooled storage: usage across every workspace this user owns, checked
    // against the license's own storageGb grant — same numbers
    // getStorageQuota() in plan-enforcement.ts uses to actually enforce
    // uploads, surfaced here so the UI can warn before the ceiling is hit.
    let storageUsedBytes: number | null = null
    let storageLimitBytes: number | null = null
    if (license.type === "enterprise" && license.storageGb) {
      storageUsedBytes = await getOwnerPooledStorageUsedBytes(userId)
      storageLimitBytes = license.storageGb * 1024 * 1024 * 1024
    }

    // AI credits: same bounded-pool pattern as storage above — same numbers
    // enforceUserAiCredits()/reserveUserAiCredits() actually enforce with.
    let aiCreditsUsed: number | null = null
    if (license.type === "enterprise" && license.aiCredits) {
      const user = await db.user.findUnique({ where: { id: userId }, select: { aiCreditsUsed: true } })
      aiCreditsUsed = user?.aiCreditsUsed ?? 0
    }

    return NextResponse.json({
      valid: true,
      status: "active",
      customerName: license.customerName,
      customerEmail: license.customerEmail,
      organization: license.organization,
      type: license.type,
      features: license.features,
      storageGb: license.storageGb,
      storageUsedBytes,
      storageLimitBytes,
      aiCredits: license.aiCredits,
      aiCreditsUsed,
      expiresAt: license.expiresAt,
      issuedAt: license.issuedAt,
      daysRemaining: license.daysRemaining,
      totalDays,
      inGracePeriod: license.inGracePeriod ?? false,
      graceDaysRemaining: license.graceDaysRemaining,
    })
  } catch (err) {
    console.error("User license status error:", err)
    return NextResponse.json({ valid: false, error: "Failed to check license" }, { status: 500 })
  }
}
