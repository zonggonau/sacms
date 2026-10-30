/**
 * GET/POST /api/admin/proposals
 * The "Penawaran" sales pipeline — offers drafted for outside institutions
 * (UMKM, sekolah, instansi pemerintah, dll), tracked through
 * PROPOSAL_STAGES up to a signed contract ("won") or a lost deal ("lost").
 * Open to any admin-portal staff role, not just super_admin — see
 * ADMIN_PORTAL_ROLES in src/app/(system)/admin/layout.tsx.
 */
import { NextResponse } from "next/server"
import { db } from "@/lib/database"
import { withAdminAuth, apiError, readJson } from "@/lib/api/route-helpers"
import { logAudit, AuditAction } from "@/lib/audit-log"
import { isValidStage } from "@/lib/proposal-stages"
import { z } from "zod"

const ALLOW_ROLES = ["employee"]

export const GET = withAdminAuth(
  async () => {
    const proposals = await db.proposal.findMany({
      orderBy: { updatedAt: "desc" },
      include: {
        assignedTo: { select: { id: true, name: true, email: true } },
        createdBy: { select: { id: true, name: true, email: true } },
        _count: { select: { activities: true } },
      },
    })
    return NextResponse.json({ proposals })
  },
  { allowRoles: ALLOW_ROLES },
)

const CreateSchema = z.object({
  institutionName: z.string().trim().min(1).max(255),
  institutionType: z.string().trim().max(100).optional(),
  contactName: z.string().trim().max(255).optional(),
  contactEmail: z.string().trim().email().max(255).optional().or(z.literal("")),
  contactPhone: z.string().trim().max(50).optional(),
  estimatedValueIdr: z.number().int().min(0).optional(),
  notes: z.string().trim().max(5000).optional(),
  assignedToId: z.string().trim().optional(),
  stage: z.string().trim().optional(),
})

export const POST = withAdminAuth(
  async (request, _context, { session }) => {
    const body = await readJson(request, CreateSchema)
    if (!body.ok) return body.response
    const data = body.data

    if (data.stage && !isValidStage(data.stage)) {
      return apiError("validation", { message: "Stage tidak valid." })
    }

    const proposal = await db.proposal.create({
      data: {
        institutionName: data.institutionName,
        institutionType: data.institutionType || null,
        contactName: data.contactName || null,
        contactEmail: data.contactEmail || null,
        contactPhone: data.contactPhone || null,
        estimatedValueIdr: data.estimatedValueIdr ?? null,
        notes: data.notes || null,
        assignedToId: data.assignedToId || null,
        stage: data.stage || "draft",
        createdById: session.user.id,
      },
    })

    logAudit({
      userId: session.user.id,
      action: AuditAction.SETTINGS_UPDATED,
      entity: "ProposalCreated",
      entityId: proposal.id,
      data: { institutionName: proposal.institutionName, stage: proposal.stage },
    })

    return NextResponse.json({ proposal })
  },
  { allowRoles: ALLOW_ROLES },
)
