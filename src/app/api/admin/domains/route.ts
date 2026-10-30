import { NextResponse } from "next/server"
import { db } from "@/lib/database"
import { diagnoseDomainDns } from "@/lib/domain-dns"
import { logAudit, AuditAction } from "@/lib/audit-log"
import { withAdminAuth, apiError } from "@/lib/api/route-helpers"
import { getRedis } from "@/lib/redis"

export const GET = withAdminAuth(
  async (request) => {
    const { searchParams } = request.nextUrl
    const search = searchParams.get("search") || ""
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "20")
    const where: any = {}
    if (search) {
      where.OR = [
        { domain: { contains: search, mode: "insensitive" } },
        { tenant: { name: { contains: search, mode: "insensitive" } } },
        { tenant: { slug: { contains: search, mode: "insensitive" } } },
      ]
    }

    const skip = (page - 1) * limit

    const [domains, total, verifiedCount, pendingCount] = await Promise.all([
      db.customDomain.findMany({
        where,
        include: {
          tenant: { select: { id: true, name: true, slug: true, plan: true, status: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      db.customDomain.count({ where }),
      db.customDomain.count({ where: { ...where, status: "verified" } }),
      db.customDomain.count({ where: { ...where, status: "pending" } }),
    ])
    return NextResponse.json({
      domains,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      verifiedCount,
      pendingCount,
    })
  },
)

export const POST = withAdminAuth(
  async (request, _context, { session }) => {
    const { domainId, action } = await request.json()
    if (!domainId) return apiError("validation", { message: "Domain ID is required" })

    const existingDomain = await db.customDomain.findUnique({ where: { id: domainId } })
    if (!existingDomain) return apiError("not_found", { message: "Custom domain not found" })

    if (action === "verify") {
      // Run the same live DNS check the tenant-facing verify flow uses —
      // an admin "Verify" click used to flip status to verified with no
      // check at all, which could mark a domain the platform can't
      // actually route to as verified.
      const diagnostics = await diagnoseDomainDns(existingDomain.domain, existingDomain.tenantId)
      if (!diagnostics.verified) {
        return apiError("validation", {
          message: "DNS check failed — the domain's records do not yet point to SaCMS. Fix DNS and try again.",
        })
      }

      const updated = await db.customDomain.update({
        where: { id: domainId },
        data: { status: "verified", verifiedAt: new Date() },
      })

      // Keep the proxy's routing map in sync — it's read from Redis key
      // `domain:<host>` with NO database fallback (see src/proxy.ts). Only
      // the tenant self-service verify flow used to write this key, so an
      // admin-triggered verify flipped the DB status but left the domain
      // unroutable until someone separately touched the tenant-facing flow.
      const tenant = await db.tenant.findUnique({ where: { id: existingDomain.tenantId }, select: { slug: true } })
      const redis = getRedis()
      if (redis && tenant) {
        await redis.set(`domain:${existingDomain.domain}`, JSON.stringify({ slug: tenant.slug, target: existingDomain.target }))
      }

      logAudit({
        userId: session.user.id,
        action: AuditAction.SETTINGS_UPDATED,
        entity: "CustomDomain",
        entityId: domainId,
        tenantId: existingDomain.tenantId,
        data: { action: "verify", domain: existingDomain.domain },
      })
      return NextResponse.json({ success: true, domain: updated })
    }
    if (action === "set_pending") {
      const updated = await db.customDomain.update({
        where: { id: domainId },
        data: { status: "pending", verifiedAt: null },
      })

      // Clear the stale routing entry — a domain demoted to pending should
      // stop resolving via the old verified mapping (see verify's comment above).
      const redis = getRedis()
      if (redis) await redis.del(`domain:${existingDomain.domain}`)

      logAudit({
        userId: session.user.id,
        action: AuditAction.SETTINGS_UPDATED,
        entity: "CustomDomain",
        entityId: domainId,
        tenantId: existingDomain.tenantId,
        data: { action: "set_pending", domain: existingDomain.domain },
      })
      return NextResponse.json({ success: true, domain: updated })
    }
    return apiError("validation", { message: "Invalid action" })
  },
)

export const DELETE = withAdminAuth(
  async (request, _context, { session }) => {
    const id = new URL(request.url).searchParams.get("id")
    if (!id) return apiError("validation", { message: "Domain ID is required" })

    const existingDomain = await db.customDomain.findUnique({ where: { id } })
    if (!existingDomain) return apiError("not_found", { message: "Custom domain not found" })

    await db.customDomain.delete({ where: { id } })

    // The confirmation dialog tells the admin traffic stops immediately —
    // without clearing the proxy's routing map (Redis `domain:<host>`, no
    // DB fallback, see src/proxy.ts) the domain kept routing to the now-deleted
    // tenant until the key happened to expire or get overwritten elsewhere.
    const redis = getRedis()
    if (redis) await redis.del(`domain:${existingDomain.domain}`)

    logAudit({
      userId: session.user.id,
      action: AuditAction.SETTINGS_UPDATED,
      entity: "CustomDomain",
      entityId: id,
      tenantId: existingDomain.tenantId,
      data: { action: "delete", domain: existingDomain.domain },
    })

    return NextResponse.json({ success: true })
  },
)
