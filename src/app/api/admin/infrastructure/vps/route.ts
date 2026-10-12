/**
 * GET /api/admin/infrastructure/vps
 * Live Contabo compute instances + SaCMS's own app health — the data behind
 * /admin/infrastruktur. Super admin only; this surfaces the real production
 * VPS (power status, specs, add-ons), not a customer-facing feature.
 */
import { NextResponse } from "next/server"
import { getContaboInstances, getContaboAvailableUpgrades } from "@/lib/contabo"
import { withAdminAuth } from "@/lib/api/route-helpers"

export const dynamic = "force-dynamic"

export const GET = withAdminAuth(async () => {
  const instancesResult = await getContaboInstances()

  if (!instancesResult.success) {
    return NextResponse.json({ configured: false, error: instancesResult.error, instances: [] })
  }

  const instances = await Promise.all(
    instancesResult.data.map(async (instance) => {
      const upgrades = await getContaboAvailableUpgrades(instance.instanceId)
      return {
        ...instance,
        availableUpgrades: upgrades.success ? upgrades.data : [],
      }
    })
  )

  let appHealth: unknown = null
  try {
    const healthUrl = process.env.NEXT_PUBLIC_APP_URL
      ? `${process.env.NEXT_PUBLIC_APP_URL}/api/health`
      : "http://127.0.0.1:3000/api/health"
    const res = await fetch(healthUrl, { cache: "no-store", signal: AbortSignal.timeout(4000) })
    appHealth = await res.json()
  } catch {
    appHealth = null
  }

  return NextResponse.json({ configured: true, instances, appHealth })
})
