import { NextResponse } from "next/server"
import { db } from "@/lib/database"
import { withStaffAuth } from "@/lib/api/route-helpers"

export const dynamic = "force-dynamic"

/** GET: the workspace's paid monthly services — storage add-ons still running and the managed database/storage service. */
export const GET = withStaffAuth(async (_request, _context, { access }) => {
  const tenantId = access.tenantId
  const [addons, managedInfra] = await Promise.all([
    db.storageAddon.findMany({
      where: { tenantId, expiresAt: { gt: new Date() } },
      orderBy: { expiresAt: "asc" },
    }),
    db.managedInfraService.findUnique({ where: { tenantId }, select: { status: true, paidUntil: true } }),
  ])
  const renewedIds = new Set(addons.map((a) => a.renewsAddonId).filter(Boolean))

  return NextResponse.json({
    storageAddons: addons.map((a) => ({
      id: a.id,
      bytes: Number(a.bytes),
      startsAt: a.startsAt,
      expiresAt: a.expiresAt,
      renewed: renewedIds.has(a.id),
    })),
    managedInfra,
  })
})
