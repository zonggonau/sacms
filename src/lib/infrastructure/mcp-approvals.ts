import { db } from "@/lib/database"

export type ApprovalAction =
  | "publish_schema_template"
  | "publish_website_template"
  | "publish_global_component"
  | "set_default_schema_template"
  | "delete_schema_template"
  | "cascade_delete_schema_template"
  | "delete_website_template"

export const APPROVAL_ACTION_LABELS: Record<ApprovalAction, string> = {
  publish_schema_template: "Publikasikan Schema Template",
  publish_website_template: "Publikasikan Website Template",
  publish_global_component: "Publikasikan Global Component",
  set_default_schema_template: "Jadikan schema default workspace baru",
  delete_schema_template: "Soft-delete Schema Template (published)",
  cascade_delete_schema_template: "Soft-delete Schema Template + Website Template-nya",
  delete_website_template: "Soft-delete Website Template (published)",
}

export interface ApprovalSummary {
  id: string
  action: string
  status: string
  message: string
}

export function summarizeApproval(request: { id: string; action: string; status: string }): ApprovalSummary {
  return {
    id: request.id,
    action: request.action,
    status: request.status,
    message: request.status === "pending"
      ? "Waiting for a super admin to approve it in the SaCMS dashboard (/admin/developer/approvals). Tell the user; poll get_approval_status."
      : `Request is ${request.status}.`,
  }
}

/** One pending request per action + target — asking twice returns the
 *  request that's already waiting instead of queueing a duplicate. */
export async function requestApproval(input: {
  action: ApprovalAction
  targetId: string
  targetName: string
  details?: Record<string, unknown>
  tokenId: string | null
  tokenName: string | null
}) {
  const existing = await db.mcpApprovalRequest.findFirst({
    where: { action: input.action, targetId: input.targetId, status: "pending" },
  })
  if (existing) return existing
  return db.mcpApprovalRequest.create({
    data: {
      action: input.action,
      targetId: input.targetId,
      targetName: input.targetName,
      details: (input.details ?? null) as object,
      requestedByTokenId: input.tokenId,
      requestedByName: input.tokenName,
    },
  })
}

async function applyApprovalAction(request: { action: string; targetId: string }): Promise<{ ok: boolean; message: string }> {
  switch (request.action) {
    case "publish_schema_template": {
      const changed = await db.schemaTemplate.updateMany({ where: { id: request.targetId }, data: { published: true } })
      return changed.count ? { ok: true, message: "Schema Template published." } : { ok: false, message: "Schema Template no longer exists." }
    }
    case "publish_website_template": {
      const changed = await db.websiteTemplate.updateMany({ where: { id: request.targetId }, data: { published: true } })
      return changed.count ? { ok: true, message: "Website Template published." } : { ok: false, message: "Website Template no longer exists." }
    }
    case "publish_global_component": {
      const changed = await db.globalComponent.updateMany({ where: { id: request.targetId }, data: { published: true } })
      return changed.count ? { ok: true, message: "Global Component published." } : { ok: false, message: "Global Component no longer exists." }
    }
    case "set_default_schema_template": {
      const target = await db.schemaTemplate.findUnique({ where: { id: request.targetId }, select: { id: true } })
      if (!target) return { ok: false, message: "Schema Template no longer exists." }
      await db.$transaction([
        db.schemaTemplate.updateMany({ where: { isDefault: true, id: { not: target.id } }, data: { isDefault: false } }),
        db.schemaTemplate.update({ where: { id: target.id }, data: { isDefault: true } }),
      ])
      return { ok: true, message: "This Schema Template now seeds every new workspace." }
    }
    case "delete_schema_template": {
      const template = await db.schemaTemplate.findUnique({ where: { id: request.targetId }, select: { id: true, isDefault: true } })
      if (!template) return { ok: false, message: "Schema Template no longer exists." }
      if (template.isDefault) return { ok: false, message: "This is the platform default schema — make another template the default first." }
      await db.schemaTemplate.update({ where: { id: template.id }, data: { deletedAt: new Date() } })
      return { ok: true, message: "Schema Template soft-deleted." }
    }
    case "cascade_delete_schema_template": {
      const template = await db.schemaTemplate.findUnique({ where: { id: request.targetId }, select: { id: true, isDefault: true, demoTenantId: true } })
      if (!template) return { ok: false, message: "Schema Template no longer exists." }
      if (template.isDefault) return { ok: false, message: "This is the platform default schema — make another template the default first." }
      const dependents = await db.websiteTemplate.findMany({ where: { schemaTemplateId: template.id }, select: { id: true, demoVercelProjectId: true } })
      const { deleteVercelProject } = await import("@/lib/vercel-client")
      for (const dependent of dependents) {
        if (dependent.demoVercelProjectId) await deleteVercelProject(dependent.demoVercelProjectId).catch(() => null)
      }
      await Promise.all([
        db.schemaTemplate.update({ where: { id: template.id }, data: { deletedAt: new Date() } }),
        db.websiteTemplate.updateMany({ where: { schemaTemplateId: template.id }, data: { deletedAt: new Date() } }),
      ])
      if (template.demoTenantId) await db.tenant.delete({ where: { id: template.demoTenantId } }).catch(() => null)
      return { ok: true, message: `Schema Template and ${dependents.length} Website Template(s) soft-deleted.` }
    }
    case "delete_website_template": {
      const template = await db.websiteTemplate.findUnique({ where: { id: request.targetId }, select: { id: true, demoVercelProjectId: true } })
      if (!template) return { ok: false, message: "Website Template no longer exists." }
      if (template.demoVercelProjectId) {
        const { deleteVercelProject } = await import("@/lib/vercel-client")
        await deleteVercelProject(template.demoVercelProjectId).catch(() => null)
      }
      await db.websiteTemplate.update({ where: { id: template.id }, data: { deletedAt: new Date() } })
      return { ok: true, message: "Website Template soft-deleted." }
    }
    default:
      return { ok: false, message: `Unknown action '${request.action}'.` }
  }
}

/**
 * Applies or rejects a pending request. The pending -> processing claim is
 * conditional, so two admins clicking at once can't apply it twice.
 */
export async function decideApproval(id: string, decision: "approve" | "reject", userId: string) {
  const claimed = await db.mcpApprovalRequest.updateMany({
    where: { id, status: "pending" },
    data: { status: decision === "approve" ? "processing" : "rejected", decidedBy: userId, decidedAt: new Date() },
  })
  if (!claimed.count) return { ok: false as const, error: "Permintaan ini sudah diputuskan atau tidak ditemukan." }
  if (decision === "reject") return { ok: true as const, status: "rejected", message: "Permintaan ditolak." }

  const request = await db.mcpApprovalRequest.findUniqueOrThrow({ where: { id } })
  let outcome: { ok: boolean; message: string }
  try {
    outcome = await applyApprovalAction(request)
  } catch (err: any) {
    outcome = { ok: false, message: err?.message || "Gagal menerapkan perubahan." }
  }
  await db.mcpApprovalRequest.update({
    where: { id },
    data: { status: outcome.ok ? "approved" : "failed", resultMessage: outcome.message },
  })
  return { ok: true as const, status: outcome.ok ? "approved" : "failed", message: outcome.message }
}
