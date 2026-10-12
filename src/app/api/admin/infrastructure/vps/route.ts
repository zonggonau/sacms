/**
 * GET /api/admin/infrastructure/vps
 * Live Contabo compute instance(s) running SaCMS Cloud itself — consumed by
 * /admin/monitoring's "Server VPS" section. Super admin only.
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

  return NextResponse.json({ configured: true, instances })
})
