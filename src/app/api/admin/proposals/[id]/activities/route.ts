/**
 * POST /api/admin/proposals/[id]/activities
 * Append a manual note/call/email/meeting entry to a Penawaran's activity
 * timeline. Stage-change entries are written automatically by the PATCH
 * handler in ../route.ts, not through here.
 */
import { NextResponse } from "next/server"
import { db } from "@/lib/database"
import { withAdminAuth, apiError, readJson } from "@/lib/api/route-helpers"
import { z } from "zod"

const ALLOW_ROLES = ["admin", "employee", "karyawan"]

const ActivitySchema = z.object({
  type: z.enum(["note", "call", "email", "meeting"]),
  message: z.string().trim().min(1).max(5000),
})

export const POST = withAdminAuth(
  async (request, context, { session }) => {
    const { id } = await context.params
    const proposal = await db.proposal.findUnique({ where: { id }, select: { id: true } })
    if (!proposal) return apiError("not_found", { message: "Penawaran tidak ditemukan." })

    const body = await readJson(request, ActivitySchema)
    if (!body.ok) return body.response

    const activity = await db.proposalActivity.create({
      data: {
        proposalId: id,
        authorId: session.user.id,
        type: body.data.type,
        message: body.data.message,
      },
      include: { author: { select: { id: true, name: true, email: true } } },
    })

    return NextResponse.json({ activity })
  },
  { allowRoles: ALLOW_ROLES },
)
