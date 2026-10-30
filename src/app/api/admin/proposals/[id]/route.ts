/**
 * GET/PATCH/DELETE /api/admin/proposals/[id]
 * A single Penawaran record. PATCH handles both ordinary field edits and
 * stage transitions — a stage change also writes a ProposalActivity row
 * (type "status_change") and sets closedAt when entering a terminal stage
 * ("won"/"lost" — see TERMINAL_STAGES in src/lib/proposal-stages.ts).
 */
import { NextResponse } from "next/server"
import { db } from "@/lib/database"
import { withAdminAuth, apiError, readJson } from "@/lib/api/route-helpers"
import { logAudit, AuditAction } from "@/lib/audit-log"
import { isValidStage, TERMINAL_STAGES } from "@/lib/proposal-stages"
import { z } from "zod"

const ALLOW_ROLES = ["employee"]

export const GET = withAdminAuth(
  async (_request, context) => {
    const { id } = await context.params
    const proposal = await db.proposal.findUnique({
      where: { id },
      include: {
        assignedTo: { select: { id: true, name: true, email: true } },
        createdBy: { select: { id: true, name: true, email: true } },
        activities: {
          orderBy: { createdAt: "desc" },
          include: { author: { select: { id: true, name: true, email: true } } },
        },
      },
    })
    if (!proposal) return apiError("not_found", { message: "Penawaran tidak ditemukan." })
    return NextResponse.json({ proposal })
  },
  { allowRoles: ALLOW_ROLES },
)

const PatchSchema = z.object({
  institutionName: z.string().trim().min(1).max(255).optional(),
  institutionType: z.string().trim().max(100).nullable().optional(),
  contactName: z.string().trim().max(255).nullable().optional(),
  contactEmail: z.string().trim().email().max(255).nullable().optional().or(z.literal("")),
  contactPhone: z.string().trim().max(50).nullable().optional(),
  estimatedValueIdr: z.number().int().min(0).nullable().optional(),
  notes: z.string().trim().max(5000).nullable().optional(),
  assignedToId: z.string().trim().nullable().optional(),
  stage: z.string().trim().optional(),
  lostReason: z.string().trim().max(1000).nullable().optional(),
  demoUrl: z.string().trim().url().max(2000).nullable().optional().or(z.literal("")),
  featuresText: z.string().trim().max(2000).nullable().optional(),
})

export const PATCH = withAdminAuth(
  async (request, context, { session }) => {
    const { id } = await context.params
    const existing = await db.proposal.findUnique({ where: { id } })
    if (!existing) return apiError("not_found", { message: "Penawaran tidak ditemukan." })

    const body = await readJson(request, PatchSchema)
    if (!body.ok) return body.response
    const data = body.data

    const newStage = data.stage
    if (newStage !== undefined && !isValidStage(newStage)) {
      return apiError("validation", { message: "Stage tidak valid." })
    }

    const stageChanged = newStage !== undefined && newStage !== existing.stage

    const updated = await db.proposal.update({
      where: { id },
      data: {
        ...(data.institutionName !== undefined ? { institutionName: data.institutionName } : {}),
        ...(data.institutionType !== undefined ? { institutionType: data.institutionType } : {}),
        ...(data.contactName !== undefined ? { contactName: data.contactName } : {}),
        ...(data.contactEmail !== undefined ? { contactEmail: data.contactEmail || null } : {}),
        ...(data.contactPhone !== undefined ? { contactPhone: data.contactPhone } : {}),
        ...(data.estimatedValueIdr !== undefined ? { estimatedValueIdr: data.estimatedValueIdr } : {}),
        ...(data.notes !== undefined ? { notes: data.notes } : {}),
        ...(data.assignedToId !== undefined ? { assignedToId: data.assignedToId } : {}),
        ...(data.lostReason !== undefined ? { lostReason: data.lostReason } : {}),
        ...(data.demoUrl !== undefined ? { demoUrl: data.demoUrl || null } : {}),
        ...(data.featuresText !== undefined ? { featuresText: data.featuresText } : {}),
        ...(stageChanged && newStage
          ? {
              stage: newStage,
              closedAt: TERMINAL_STAGES.includes(newStage) ? new Date() : null,
            }
          : {}),
      },
    })

    if (stageChanged) {
      await db.proposalActivity.create({
        data: {
          proposalId: id,
          authorId: session.user.id,
          type: "status_change",
          fromStage: existing.stage,
          toStage: newStage,
          message: newStage === "lost" ? data.lostReason || null : null,
        },
      })
    }

    logAudit({
      userId: session.user.id,
      action: AuditAction.SETTINGS_UPDATED,
      entity: "ProposalUpdated",
      entityId: id,
      data: { changedFields: Object.keys(data) },
    })

    return NextResponse.json({ proposal: updated })
  },
  { allowRoles: ALLOW_ROLES },
)

export const DELETE = withAdminAuth(
  async (_request, context, { session }) => {
    const { id } = await context.params
    const existing = await db.proposal.findUnique({ where: { id } })
    if (!existing) return apiError("not_found", { message: "Penawaran tidak ditemukan." })

    await db.proposal.delete({ where: { id } })

    logAudit({
      userId: session.user.id,
      action: AuditAction.SETTINGS_UPDATED,
      entity: "ProposalDeleted",
      entityId: id,
      data: { institutionName: existing.institutionName },
    })

    return NextResponse.json({ success: true })
  },
  { allowRoles: ALLOW_ROLES },
)
