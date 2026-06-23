/**
 * POST /api/enterprise/validate
 * Validates a license key (called by self-hosted instances)
 * This is the LICENSE SERVER endpoint
 */
import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/database"
import { parseLicenseKey, isLicenseExpired } from "@/lib/license"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { licenseKey } = body

    if (!licenseKey) {
      return NextResponse.json({ error: "licenseKey is required" }, { status: 400 })
    }

    // 1. Parse & verify RSA signature
    const { payload, error } = parseLicenseKey(licenseKey)
    if (!payload) {
      return NextResponse.json({ valid: false, error }, { status: 400 })
    }

    // 2. Check DB record
    const license = await db.enterpriseLicense.findUnique({
      where: { licenseKey },
    })

    if (!license) {
      return NextResponse.json({
        valid: false,
        error: "License key not found in our records. Please contact SaCMS support.",
      }, { status: 404 })
    }

    // 3. Check status
    if (license.status === "revoked") {
      return NextResponse.json({
        valid: false,
        status: "revoked",
        error: "This license has been revoked.",
      })
    }

    // 4. Check expiry
    if (isLicenseExpired(payload)) {
      return NextResponse.json({
        valid: false,
        status: "expired",
        customerName: license.customerName,
        customerEmail: license.customerEmail,
        organization: license.organization,
        type: license.type,
        features: license.features,
        expiresAt: license.expiresAt,
        issuedAt: license.issuedAt,
        error: "License has expired. Please renew.",
      })
    }

    // 5. Update validation record
    await db.enterpriseLicense.update({
      where: { id: license.id },
      data: {
        lastValidatedAt: new Date(),
        validatedCount: { increment: 1 },
      },
    })

    return NextResponse.json({
      valid: true,
      customerName: license.customerName,
      customerEmail: license.customerEmail,
      organization: license.organization,
      type: license.type,
      features: license.features,
      expiresAt: license.expiresAt,
      issuedAt: license.issuedAt,
      status: "active",
    })
  } catch (err) {
    console.error("License validation error:", err)
    return NextResponse.json({ valid: false, error: "Validation failed" }, { status: 500 })
  }
}
