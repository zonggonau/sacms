/**
 * POST /api/enterprise/activate
 * Activate a license key on this self-hosted instance
 */
import { NextRequest, NextResponse } from "next/server"
import { parseLicenseKey, isLicenseExpired, upsertLicenseCache } from "@/lib/license"

import { db } from "@/lib/database"

export async function POST(request: NextRequest, { params }: { params: Promise<{ tenant: string }> }) {
  try {
    const { tenant: tenantId } = await params
    const body = await request.json()
    const { licenseKey } = body

    if (!licenseKey) {
      return NextResponse.json({ error: "licenseKey is required" }, { status: 400 })
    }

    // 1. Parse & verify RSA signature
    const { payload, error } = parseLicenseKey(licenseKey)
    if (!payload) {
      return NextResponse.json({ error: error || "Invalid license key" }, { status: 400 })
    }

    // 2. Check expiry
    if (isLicenseExpired(payload)) {
      return NextResponse.json({
        error: "This license key has expired",
        expiresAt: new Date(payload.exp * 1000).toISOString(),
        expiredSince: new Date(payload.exp * 1000).toISOString(),
      }, { status: 400 })
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
          const data = await res.json()
          return NextResponse.json({
            error: data.error || "License validation failed on license server",
          }, { status: 400 })
        }
      } catch {
        // License server unreachable — continue with offline activation
        console.warn("[License] License server unreachable, activating offline")
      }
    }

    // 4. Cache the license locally
    await upsertLicenseCache({
      valid: true,
      customerName: payload.name,
      customerEmail: payload.email,
      organization: payload.org,
      type: payload.type,
      features: payload.features,
      expiresAt: new Date(payload.exp * 1000),
      issuedAt: new Date(payload.iat * 1000),
      daysRemaining: Math.max(0, Math.floor((payload.exp * 1000 - Date.now()) / 86400000)),
      status: "active",
    }, tenantId, licenseKey)

    // 5. Also store in Tenant model for persistence (if not global)
    if (tenantId !== "sacms-global") {
      await db.tenant.update({
        where: { id: tenantId },
        data: { licenseKey },
      })
    }

    return NextResponse.json({
      success: true,
      message: "License activated successfully",
      customerName: payload.name,
      type: payload.type,
      expiresAt: new Date(payload.exp * 1000),
      daysRemaining: Math.max(0, Math.floor((payload.exp * 1000 - Date.now()) / 86400000)),
    })
  } catch (err) {
    console.error("License activation error:", err)
    return NextResponse.json({ error: "Activation failed" }, { status: 500 })
  }
}
