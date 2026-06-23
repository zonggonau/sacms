/**
 * GET /api/enterprise/status
 * Returns the current enterprise license status (for self-hosted instance UI)
 */
import { NextRequest, NextResponse } from "next/server"
import { getCachedLicense, validateLicense, parseLicenseKey } from "@/lib/license"
import { db } from "@/lib/database"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest, { params }: { params: Promise<{ tenant: string }> }) {
  const { tenant: tenantId } = await params
  try {
    // 1. Try database cache first
    let license = await getCachedLicense(tenantId)

    // 2. If no valid cache, validate (this checks DB for key)
    if (!license || !license.valid) {
      license = await validateLicense(tenantId)
    }

    // 3. If still no valid license, return invalid/no-license status
    if (!license || !license.valid) {
      return NextResponse.json({
        valid: false,
        status: license?.status || "no_license",
        error: license?.error || "No license key configured. Set LICENSE_KEY in your environment or activate via UI.",
        customerName: license?.customerName,
        type: license?.type,
        expiresAt: license?.expiresAt,
        issuedAt: license?.issuedAt,
      })
    }

    // 4. Retrieve the key used to compute total days
    const cachedRecord = await db.licenseCache.findUnique({
      where: { id: tenantId },
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

    return NextResponse.json({
      valid: true,
      status: "active",
      customerName: license.customerName,
      customerEmail: license.customerEmail,
      organization: license.organization,
      type: license.type,
      features: license.features,
      expiresAt: license.expiresAt,
      issuedAt: license.issuedAt,
      daysRemaining: license.daysRemaining,
      totalDays,
    })
  } catch (err) {
    console.error("License status error:", err)
    return NextResponse.json({ valid: false, error: "Failed to check license" }, { status: 500 })
  }
}
