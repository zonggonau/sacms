import { NextResponse } from "next/server"
import { db } from "@/lib/database"
import { withAdminAuth } from "@/lib/api/route-helpers"

export const GET = withAdminAuth(async (request) => {
  const { searchParams } = new URL(request.url)
  const page = parseInt(searchParams.get("page") || "1")
  const limit = parseInt(searchParams.get("limit") || "50")
  const tenantId = searchParams.get("tenantId")
  const userId = searchParams.get("userId")
  const action = searchParams.get("action")
  const entity = searchParams.get("entity")
  const search = searchParams.get("search")

  const where: Record<string, unknown> = {}
  if (tenantId) where.tenantId = tenantId
  if (userId) where.userId = userId
  if (action) where.action = action
  if (entity) where.entity = entity
  if (search) {
    where.OR = [
      { userId: { contains: search, mode: "insensitive" } },
      { entityId: { contains: search, mode: "insensitive" } },
      { action: { contains: search, mode: "insensitive" } },
    ]
  }

  const [total, logs] = await Promise.all([
    db.auditLog.count({ where }),
    db.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ])

  return NextResponse.json({
    logs,
    pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
  })
})
