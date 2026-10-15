import { NextResponse } from "next/server"
import { db } from "@/lib/database"
import { getRedis } from "@/lib/redis"
import { getGlobalWorkspaceId } from "@/lib/settings"
import { validateLicense } from "@/lib/license"
import { authorizeCronRequest } from "@/lib/cron-auth"

/**
 * GET /api/cron/license-check
 *
 * Re-validates this install's enterprise license (RSA signature + expiry,
 * plus an online check if LICENSE_SERVER_URL is set — see validateLicense())
 * and writes the result to the Redis key src/proxy.ts's hard lockout reads
 * ("system:license-lockout"). Intended for standalone/self-hosted installs
 * (LICENSE_KEY env var) — on the live multi-tenant SaaS this just reports
 * "not locked" every time, which is harmless but unnecessary; the cron
 * schedule for this route only needs to exist on a standalone deployment.
 *
 * Requires CRON_SECRET header for security.
 */
export async function GET(request: Request) {
  const unauthorized = authorizeCronRequest(request)
  if (unauthorized) return unauthorized

  try {
    const tenantId = await getGlobalWorkspaceId()

    // validateLicense() short-circuits on a warm, still-"active" LicenseCache
    // row and skips its own re-check (including the online call) entirely —
    // without clearing it first, this cron would never notice an expiry or
    // a revoke after the first successful validation.
    await db.licenseCache.delete({ where: { id: tenantId } }).catch(() => {})

    const result = await validateLicense(tenantId)

    const redis = getRedis()
    if (redis) {
      await redis.set(
        "system:license-lockout",
        {
          locked: !result.valid,
          reason: result.error || result.status,
          expiresAt: result.expiresAt,
          checkedAt: new Date().toISOString(),
        },
        { ex: 7200 }
      )
    }

    return NextResponse.json({ locked: !result.valid, status: result.status })
  } catch (error) {
    console.error("Cron license-check error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
