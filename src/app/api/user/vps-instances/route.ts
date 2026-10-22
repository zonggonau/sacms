/**
 * GET /api/user/vps-instances
 * The CALLER's own account-scoped VPS instances (tenantId null — bought
 * from /dashboard/billing, meant to serve as shared infrastructure for
 * every workspace this account owns). Same reveal convention as the
 * tenant-scoped route.
 */
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/database"
import { apiError } from "@/lib/api/route-helpers"
import { logAudit, AuditAction } from "@/lib/audit-log"
import { rateLimit } from "@/lib/rate-limit"

const MASK = "••••••••"

export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return apiError("unauthorized")

  const { searchParams } = new URL(request.url)
  const reveal = searchParams.get("reveal")

  if (reveal) {
    const instance = await db.vpsInstance.findFirst({ where: { id: reveal, ownerId: session.user.id, tenantId: null } })
    if (!instance) return apiError("not_found", { message: "VPS tidak ditemukan" })

    const rl = await rateLimit(`vps-reveal:${session.user.id}`, { limit: 10, windowSeconds: 60 })
    if (!rl.success) return apiError("rate_limited", { message: "Terlalu banyak percobaan. Coba lagi sebentar lagi." })

    logAudit({
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
    where: { ownerId: session.user.id, tenantId: null },
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
      dbStorageStatus: i.dbStorageStatus,
      dbStorageError: i.dbStorageError,
      nextDueAt: i.nextDueAt,
      createdAt: i.createdAt,
      offering: i.offering,
    })),
  })
}
