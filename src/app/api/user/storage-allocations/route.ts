/**
 * GET /api/user/storage-allocations
 * The caller's own per-workspace breakdown of their pooled Enterprise
 * storage grant — which owned workspaces have an explicit GB slice vs. an
 * auto-split share of the remainder, and how much each has actually used
 * (including its own storage add-ons). Kept separate from
 * /api/user/license/status (which EnterpriseLicenseBanner polls on every
 * dashboard mount and is deliberately cheap) because this does an N-tenant
 * fan-out and should only run when the allocation UI is actually opened.
 */
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/database"
import { apiError } from "@/lib/api/route-helpers"
import {
  getOwnerStorageLicense,
  getOwnerStorageAllocationPlan,
  getOwnerPooledStorageUsedBytes,
  getOwnerFlatStorageAllocation,
  hasOwnerByos,
  getStorageQuota,
} from "@/lib/plan-enforcement"

export const dynamic = "force-dynamic"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return apiError("unauthorized")
  const ownerId = session.user.id

  const ownerLicense = await getOwnerStorageLicense(ownerId)
  const byos = ownerLicense.licensed ? false : await hasOwnerByos(ownerId)
  if (!ownerLicense.licensed && !byos) {
    return NextResponse.json({ licensed: false })
  }
  const poolMode: "enterprise" | "byos" = ownerLicense.licensed ? "enterprise" : "byos"

  const [plan, poolUsedBytes, ownedMemberships] = await Promise.all([
    poolMode === "enterprise" ? getOwnerStorageAllocationPlan(ownerId, ownerLicense.limitBytes) : null,
    getOwnerPooledStorageUsedBytes(ownerId),
    db.tenantMember.findMany({
      where: { userId: ownerId, role: "owner" },
      select: { tenant: { select: { id: true, name: true, slug: true } } },
    }),
  ])

  const workspaces = await Promise.all(
    ownedMemberships.map(async ({ tenant }) => {
      const quota = await getStorageQuota(tenant.id)
      const slice = plan
        ? plan.get(tenant.id) ?? { allocatedBytes: 0, isExplicit: false }
        : await getOwnerFlatStorageAllocation(ownerId, tenant.id)
      return {
        tenantId: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        allocatedBytes: slice.allocatedBytes,
        isExplicit: slice.isExplicit,
        usedBytes: quota.usedBytes,
        addonBytes: quota.addonBytes,
        effectiveLimitBytes: quota.limitBytes ?? slice.allocatedBytes,
      }
    })
  )

  const explicitTotalBytes = workspaces
    .filter((w) => w.isExplicit)
    .reduce((sum, w) => sum + w.allocatedBytes, 0)

  return NextResponse.json({
    licensed: true,
    poolMode,
    // No fixed total to report or overflow-check against for an owner's
    // own VPS/MinIO — every workspace's allocation is independent there.
    poolLimitBytes: poolMode === "enterprise" ? ownerLicense.limitBytes : null,
    poolUsedBytes,
    overAllocated: poolMode === "enterprise" && explicitTotalBytes > ownerLicense.limitBytes,
    workspaces,
  })
}
