/**
 * GET /api/enterprise/status
 * Returns the current enterprise license status (for self-hosted instance UI)
 */
import { NextResponse } from "next/server"
import { getCachedLicense, validateLicense, parseLicenseKey } from "@/lib/license"

const LICENSE_KEY = process.env.LICENSE_KEY || ""

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    if (!LICENSE_KEY) {
      return NextResponse.json({
        valid: false,
        status: "no_license",
        error: "No license key configured. Set LICENSE_KEY in your environment.",
      })
    }

    // Try cache first
    let license = await getCachedLicense()
    if (!license) {
      license = await validateLicense()
    }

    if (!license || !license.valid) {
      return NextResponse.json({
        valid: false,
        status: license?.status || "invalid",
        error: license?.error || "Invalid or expired license",
        customerName: license?.customerName,
        type: license?.type,
        expiresAt: license?.expiresAt,
        issuedAt: license?.issuedAt,
      })
    }

    // Parse the actual key to get total days
    const { payload } = parseLicenseKey(LICENSE_KEY)
    const totalDays = payload
      ? Math.round((payload.exp - payload.iat) / 86400)
      : 365

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
