import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/database"
import { getTenantAccess } from "@/lib/tenant-access"
import { replayDeadLetter } from "@/lib/webhooks"

/**
 * GET /api/tenant/[tenant]/webhooks/dead-letters
 * List dead letter queue entries for a tenant
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tenant: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { tenant } = await params
    const access = await getTenantAccess(session, tenant)
    if (!access || !["owner", "admin"].includes(access.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status") || undefined
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"))
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") || "25")))

    const where = {
      webhook: { tenantId: access.tenantId },
      ...(status ? { status } : {}),
    }

    const [entries, total] = await Promise.all([
      db.webhookDeadLetter.findMany({
        where,
        include: {
          webhook: { select: { id: true, name: true, url: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.webhookDeadLetter.count({ where }),
    ])

    return NextResponse.json({
      data: entries,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    })
  } catch (error) {
    console.error("Error listing dead letters:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * POST /api/tenant/[tenant]/webhooks/dead-letters
 * Replay a dead letter entry: body = { deadLetterId: string }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tenant: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { tenant } = await params
    const access = await getTenantAccess(session, tenant)
    if (!access || !["owner", "admin"].includes(access.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const deadLetterId = body?.deadLetterId
    if (!deadLetterId || typeof deadLetterId !== "string") {
      return NextResponse.json({ error: "deadLetterId is required" }, { status: 400 })
    }

    // Verify the dead letter belongs to this tenant
    const dl = await db.webhookDeadLetter.findUnique({
      where: { id: deadLetterId },
      include: { webhook: { select: { tenantId: true } } },
    })
    if (!dl || dl.webhook.tenantId !== access.tenantId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const success = await replayDeadLetter(deadLetterId)

    return NextResponse.json({ success, deadLetterId })
  } catch (error) {
    console.error("Error replaying dead letter:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
