import { NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/lib/database"
import { replayDeadLetter } from "@/lib/webhooks"
import { withStaffAuth, apiError, readJson } from "@/lib/api/route-helpers"

/** GET /api/tenant/[tenant]/webhooks/dead-letters — list DLQ entries. */
export const GET = withStaffAuth(
  async (request, _context, { access }) => {
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
        include: { webhook: { select: { id: true, name: true, url: true } } },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.webhookDeadLetter.count({ where }),
    ])

    return NextResponse.json({
      data: entries,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    })
  },
  { minRole: "admin" },
)

const ReplaySchema = z.object({ deadLetterId: z.string().min(1) })

/** POST /api/tenant/[tenant]/webhooks/dead-letters — replay one entry. */
export const POST = withStaffAuth(
  async (request, _context, { access }) => {
    const body = await readJson(request, ReplaySchema)
    if (!body.ok) return body.response

    const dl = await db.webhookDeadLetter.findUnique({
      where: { id: body.data.deadLetterId },
      include: { webhook: { select: { tenantId: true } } },
    })
    if (!dl || dl.webhook.tenantId !== access.tenantId) {
      return apiError("not_found", { message: "Dead-letter entry not found" })
    }

    const success = await replayDeadLetter(body.data.deadLetterId)
    return NextResponse.json({ success, deadLetterId: body.data.deadLetterId })
  },
  { minRole: "admin" },
)
