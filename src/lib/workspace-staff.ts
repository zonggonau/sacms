import { z } from "zod/v4"
import { db, getTenantDbById, Prisma, type PrismaClient } from "@/lib/database"
import { isPlatformStaff } from "@/lib/platform-roles"
import { isWorkspaceAdmin, roleMeets, STAFF_ROLES, type StaffRole } from "@/lib/rbac/staff"
import { AuditAction, logAudit } from "@/lib/audit-log"

const customPermissions = z.array(z.string().max(80)).max(50).optional()

export const addWorkspaceStaffSchema = z.strictObject({
  email: z.string().trim().toLowerCase().email(),
  role: z.enum(STAFF_ROLES).default("viewer"),
  name: z.string().trim().max(120).optional(),
  customPermissions,
})

// Reject legacy password fields explicitly. An account credential is shared
// across all workspaces and must only be changed by the account holder.
export const updateWorkspaceStaffSchema = z.strictObject({
  role: z.enum(STAFF_ROLES).optional(),
  customPermissions,
})

export const workspaceStaffUserSelect = { id: true, name: true, email: true, image: true, role: true } as const

export class WorkspaceStaffError extends Error {
  constructor(
    readonly code: "validation" | "forbidden" | "not_found" | "conflict" | "plan_limit",
    message: string,
    readonly details?: { current: number; max: number; plan: string },
  ) {
    super(message)
  }
}

interface StaffActor {
  id: string
  role: string
}

async function withWorkspaceLock<T>(
  tenantId: string,
  actor: StaffActor,
  mutate: (tx: Prisma.TransactionClient, tenantDb: PrismaClient, role: string, ownerId: string | null) => Promise<T>,
) {
  const tenantDb = await getTenantDbById(tenantId)
  return db.$transaction(async (tx) => {
    const [tenant] = await tx.$queryRaw<Array<{ ownerId: string | null }>>`
      SELECT "ownerId" FROM "tenants" WHERE id = ${tenantId} FOR UPDATE
    `
    if (!tenant) throw new WorkspaceStaffError("not_found", "Workspace tidak ditemukan")

    const actorRole = isPlatformStaff(actor.role) ? "owner" : (await tx.tenantMember.findUnique({
      where: { tenantId_userId: { tenantId, userId: actor.id } },
      select: { role: true },
    }))?.role

    if (!actorRole || !isWorkspaceAdmin(actorRole)) {
      throw new WorkspaceStaffError("forbidden", "Hanya admin dan pemilik workspace yang dapat mengelola anggota")
    }

    return mutate(tx, tenantDb, actorRole, tenant.ownerId)
  })
}

function requireManageableRole(actorRole: string, targetRole: StaffRole | string) {
  if (actorRole !== "owner" && roleMeets(targetRole, "admin")) {
    throw new WorkspaceStaffError("forbidden", "Hanya pemilik workspace yang dapat mengelola peran Admin dan Owner")
  }
}

async function mirrorStaffMember(
  tenantDb: PrismaClient,
  member: { id: string; tenantId: string; userId: string; role: string; customPermissions: Prisma.JsonValue },
  user: { id: string; name: string | null; email: string; image: string | null; role: string; emailVerified: Date | null },
) {
  if (tenantDb === db) return
  // The primary database is the account authority. Never copy its password hash.
  await tenantDb.$transaction(async (tx) => {
    await tx.user.upsert({ where: { id: user.id }, create: user, update: user })
    const permissions = (member.customPermissions ?? Prisma.DbNull) as Prisma.InputJsonValue | typeof Prisma.DbNull
    await tx.tenantMember.upsert({
      where: { tenantId_userId: { tenantId: member.tenantId, userId: member.userId } },
      create: {
        id: member.id,
        tenantId: member.tenantId,
        userId: member.userId,
        role: member.role,
        customPermissions: permissions,
      },
      update: { role: member.role, customPermissions: permissions },
    })
  })
}

export async function addWorkspaceStaff(
  tenantId: string,
  actor: StaffActor,
  input: z.output<typeof addWorkspaceStaffSchema>,
) {
  const { member, activationRequired } = await withWorkspaceLock(tenantId, actor, async (tx, tenantDb, actorRole) => {
    requireManageableRole(actorRole, input.role)
    const { enforcePlanLimit } = await import("@/lib/plan-enforcement")
    const limit = await enforcePlanLimit(tenantId, "team_members", actor.id)
    if (!limit.allowed) {
      throw new WorkspaceStaffError("plan_limit", limit.message ?? "Batas anggota workspace tercapai", {
        current: limit.current, max: limit.max, plan: limit.planSlug,
      })
    }

    const select = { ...workspaceStaffUserSelect, emailVerified: true, password: true }
    let user = await tx.user.findFirst({ where: { email: { equals: input.email, mode: "insensitive" } }, select })
    if (!user || (!user.password && !user.emailVerified)) {
      const { isMailConfigured } = await import("@/lib/settings")
      if (!await isMailConfigured()) {
        throw new WorkspaceStaffError("validation", "Minta anggota mendaftar dahulu atau aktifkan layanan email untuk aktivasi akun baru")
      }
    }
    user ??= await tx.user.upsert({
      where: { email: input.email },
      update: {},
      create: { email: input.email, name: input.name || input.email.split("@")[0], role: "user" },
      select,
    })
    const existing = await tx.tenantMember.findUnique({
      where: { tenantId_userId: { tenantId, userId: user.id } },
      select: { id: true },
    })
    if (existing) throw new WorkspaceStaffError("conflict", "Pengguna sudah menjadi anggota")

    const member = await tx.tenantMember.create({
      data: { tenantId, userId: user.id, role: input.role, customPermissions: input.customPermissions },
      include: { user: { select: workspaceStaffUserSelect } },
    })
    const { password, ...mirrorUser } = user
    await mirrorStaffMember(tenantDb, member, mirrorUser)
    return { member, activationRequired: !user.emailVerified && !password }
  })
  logAudit({
    tenantId, userId: actor.id, action: AuditAction.MEMBER_ADDED, entity: "TenantMember",
    entityId: member.id, data: { targetUserId: member.userId, role: input.role },
  })
  return { member, activationRequired }
}

export async function updateWorkspaceStaff(
  tenantId: string,
  actor: StaffActor,
  memberId: string,
  input: z.output<typeof updateWorkspaceStaffSchema>,
) {
  const member = await withWorkspaceLock(tenantId, actor, async (tx, tenantDb, actorRole, ownerId) => {
    const existing = await tx.tenantMember.findFirst({
      where: { id: memberId, tenantId },
      include: { user: { select: { ...workspaceStaffUserSelect, emailVerified: true } } },
    })
    if (!existing) throw new WorkspaceStaffError("not_found", "Anggota tidak ditemukan")
    requireManageableRole(actorRole, existing.role)

    if (input.role && input.role !== existing.role) {
      requireManageableRole(actorRole, input.role)
      if (existing.userId === actor.id) throw new WorkspaceStaffError("forbidden", "Anda tidak dapat mengubah peran sendiri")
      if (existing.userId === ownerId) throw new WorkspaceStaffError("forbidden", "Peran pemilik utama workspace tidak dapat diubah")
      if (existing.role === "owner" && await tx.tenantMember.count({ where: { tenantId, role: "owner" } }) <= 1) {
        throw new WorkspaceStaffError("validation", "Workspace harus memiliki setidaknya satu Owner")
      }
    }

    const updated = await tx.tenantMember.update({ where: { id: memberId }, data: input })
    await mirrorStaffMember(tenantDb, updated, existing.user)
    return existing
  })
  logAudit({
    tenantId, userId: actor.id, action: AuditAction.MEMBER_ROLE_CHANGED, entity: "TenantMember",
    entityId: memberId, data: { targetUserId: member.userId, fromRole: member.role, toRole: input.role ?? member.role },
  })
}

export async function removeWorkspaceStaff(tenantId: string, actor: StaffActor, memberId: string) {
  const member = await withWorkspaceLock(tenantId, actor, async (tx, tenantDb, actorRole, ownerId) => {
    const existing = await tx.tenantMember.findFirst({ where: { id: memberId, tenantId } })
    if (!existing) throw new WorkspaceStaffError("not_found", "Anggota tidak ditemukan")
    requireManageableRole(actorRole, existing.role)
    if (existing.userId === actor.id) throw new WorkspaceStaffError("validation", "Anda tidak dapat menghapus keanggotaan sendiri")
    if (existing.userId === ownerId) throw new WorkspaceStaffError("forbidden", "Pemilik utama workspace tidak dapat dikeluarkan")
    if (existing.role === "owner" && await tx.tenantMember.count({ where: { tenantId, role: "owner" } }) <= 1) {
      throw new WorkspaceStaffError("validation", "Workspace harus memiliki setidaknya satu Owner")
    }

    await tx.tenantMember.delete({ where: { id: memberId } })
    if (tenantDb !== db) {
      await tenantDb.tenantMember.deleteMany({ where: { tenantId, userId: existing.userId } })
    }
    return existing
  })
  logAudit({
    tenantId, userId: actor.id, action: AuditAction.MEMBER_REMOVED, entity: "TenantMember",
    entityId: member.id, data: { targetUserId: member.userId },
  })
}
