/**
 * GET /api/tenant/[tenant]/vps-instances
 * This workspace's purchased VPS instances. Root password is masked by
 * default — pass ?reveal=<instanceId> to fetch the real value once
 * (rate-limited and audited), same convention as
 * /api/auth/user/infrastructure's ?reveal= query param.
 */
import { NextResponse } from "next/server"
import { db } from "@/lib/database"
import { withStaffAuth, apiError } from "@/lib/api/route-helpers"
import { logAudit, AuditAction } from "@/lib/audit-log"
import { rateLimit } from "@/lib/rate-limit"

const MASK = "••••••••"

export const GET = withStaffAuth(async (request, _context, { access, session }) => {
  const reveal = request.nextUrl.searchParams.get("reveal")

  if (reveal) {
    const instance = await db.vpsInstance.findFirst({ where: { id: reveal, tenantId: access.tenantId } })
    if (!instance) return apiError("not_found", { message: "VPS tidak ditemukan" })

    const rl = await rateLimit(`vps-reveal:${session.user.id}`, { limit: 10, windowSeconds: 60 })
    if (!rl.success) return apiError("rate_limited", { message: "Terlalu banyak percobaan. Coba lagi sebentar lagi." })

    logAudit({
      tenantId: access.tenantId,
      userId: session.user.id,
      action: AuditAction.SECRET_REVEALED,
      entity: "VpsInstance",
      entityId: instance.id,
    })
    return NextResponse.json({
      rootUser: instance.rootUser || "",
      rootPassword: instance.rootPassword || "",
    })
  }

  const instances = await db.vpsInstance.findMany({
    where: { tenantId: access.tenantId },
    include: { offering: { select: { name: true, osLabel: true, cpuCores: true, memoryMb: true, diskGb: true } } },
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json({
    instances: instances.map((i) => ({
      id: i.id,
      status: i.status,
      billingCycle: i.billingCycle,
      hostname: i.hostname,
      ipAddress: i.ipAddress,
      rootUser: i.rootUser,
      rootPassword: i.rootPassword ? MASK : null,
      failureReason: i.failureReason,
      nextDueAt: i.nextDueAt,
      createdAt: i.createdAt,
      offering: i.offering,
    })),
  })
})
