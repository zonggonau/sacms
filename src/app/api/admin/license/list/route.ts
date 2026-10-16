/**
 * GET /api/admin/license/list — list all enterprise licenses.
 */
import { NextResponse } from "next/server"
import { db } from "@/lib/database"
import { withAdminAuth } from "@/lib/api/route-helpers"

export const GET = withAdminAuth(
  async (request) => {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status") // active | expired | revoked
    const search = searchParams.get("search") || ""
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "20")

    // "expired" is never a stored DB status (PATCH only accepts
    // active/revoked — see [id]/route.ts) — it's a derived state (expiresAt
    // in the past, but never revoked). Filtering used to only happen
    // client-side over whatever page was already fetched, so selecting a
    // status showed an incomplete, inconsistent view while the pager still
    // walked the unfiltered total.
    const now = new Date()
    const and: any[] = []
    if (status === "active") {
      and.push({ status: "active" }, { expiresAt: { gte: now } })
    } else if (status === "expired") {
      and.push({ status: { not: "revoked" } }, { expiresAt: { lt: now } })
    } else if (status === "revoked") {
      and.push({ status: "revoked" })
    }
    if (search) {
      and.push({
        OR: [
          { customerName: { contains: search, mode: "insensitive" } },
          { customerEmail: { contains: search, mode: "insensitive" } },
          { organization: { contains: search, mode: "insensitive" } },
        ],
      })
    }
    const where: any = and.length > 0 ? { AND: and } : {}

    const skip = (page - 1) * limit

    const [licenses, total] = await Promise.all([
      db.enterpriseLicense.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: { _count: { select: { activations: true } } },
      }),
      db.enterpriseLicense.count({ where }),
    ])

    const enriched = licenses.map((l) => ({
      id: l.id,
      displayKey: `${l.licenseKey.slice(0, 10)}...${l.licenseKey.slice(-6)}`,
      customerName: l.customerName,
      customerEmail: l.customerEmail,
      organization: l.organization,
      type: l.type,
      storageGb: l.storageGb,
      aiCredits: l.aiCredits,
      maxInstances: l.maxInstances,
      activationCount: l._count.activations,
      expiresAt: l.expiresAt,
      isExpired: l.expiresAt < now,
      daysRemaining: Math.max(0, Math.floor((l.expiresAt.getTime() - now.getTime()) / 86400000)),
      status: l.status,
      lastValidatedAt: l.lastValidatedAt,
      validatedCount: l.validatedCount,
      createdAt: l.createdAt,
    }))

    return NextResponse.json({ licenses: enriched, total, page, totalPages: Math.ceil(total / limit) })
  },
)
