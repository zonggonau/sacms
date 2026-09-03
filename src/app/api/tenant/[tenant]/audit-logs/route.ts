import { NextResponse } from "next/server"
import { db } from "@/lib/database"
import { withStaffAuth } from "@/lib/api/route-helpers"

/** GET /api/tenant/[tenant]/audit-logs — workspace audit trail (admin/owner only). */
export const GET = withStaffAuth(
  async (request, _context, { access }) => {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get("page") || "1")
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100)
    const action = searchParams.get("action")
    const entity = searchParams.get("entity")
    const userId = searchParams.get("userId")

    const where: Record<string, unknown> = { tenantId: access.tenantId }
    if (action) where.action = action
    if (entity) where.entity = entity
    if (userId) where.userId = userId

    const [total, logs] = await Promise.all([
      db.auditLog.count({ where }),
      db.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ])

    // AuditLog has no Prisma relation to User — hydrate manually.
    const userIds = Array.from(new Set(logs.map((log) => log.userId).filter(Boolean))) as string[]
    const users = await db.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, email: true, image: true },
    })
    const userMap = new Map(users.map((u) => [u.id, u]))
    const logsWithUser = logs.map((log) => ({
      ...log,
      user: log.userId ? userMap.get(log.userId) || null : null,
    }))

    return NextResponse.json({
      logs: logsWithUser,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    })
  },
  { minRole: "admin" },
)
