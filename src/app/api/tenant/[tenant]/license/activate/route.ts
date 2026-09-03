/**
 * POST /api/tenant/[tenant]/license/activate
 * Activate an enterprise license key on a workspace.
 *
 * Requires the caller to be an owner of the workspace (withStaffAuth minRole:
 * "owner"). The RSA signature proves the key is genuine; this gate proves the
 * caller is entitled to attach it here.
 */
import { NextResponse } from "next/server"
import { parseLicenseKey, isLicenseExpired, upsertLicenseCache } from "@/lib/license"
import { db } from "@/lib/database"
import { withStaffAuth, apiError, readJson } from "@/lib/api/route-helpers"
import { z } from "zod"

export const dynamic = "force-dynamic"

const ActivateSchema = z.object({ licenseKey: z.string().min(1).max(8000) })

export const POST = withStaffAuth(
  async (request, context, { access }) => {
    const { tenant: tenantId } = await context.params

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

    // 4. Cache the license locally, scoped to the resolved tenant
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
    }, access.tenantId, licenseKey)

    // 5. Persist on the Tenant row (skip the global workspace)
    if (!access.isGlobal) {
      await db.tenant
        .update({ where: { id: access.tenantId }, data: { licenseKey } })
        .catch((err: { code?: string }) => {
          if (err.code !== "P2025") throw err
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
  },
  { minRole: "owner" },
)
