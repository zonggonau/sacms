import { db, type Prisma } from "@/lib/database"

type WorkspaceDb = Pick<Prisma.TransactionClient, "tenantMember">

export function countOwnedWorkspaces(client: WorkspaceDb, userId: string, globalTenantId: string) {
  return client.tenantMember.count({
    where: {
      userId,
      role: "owner",
      tenant: {
        slug: { notIn: [globalTenantId, "sacms-global", "sacms"] },
        id: { not: globalTenantId },
      },
    },
  })
}

export async function withWorkspaceCreation<T>(
  userId: string,
  plan: string,
  create: (tx: Prisma.TransactionClient) => Promise<T>,
) {
  const { enforceUserPlanLimit, validateWorkspacePlanBinding } = await import("@/lib/plan-enforcement")
  const limit = await enforceUserPlanLimit(userId, "workspaces")
  if (!limit.allowed) return { ok: false as const, error: limit.message, limit }

  const planBinding = await validateWorkspacePlanBinding(userId, plan)
  if (!planBinding.allowed) return { ok: false as const, error: planBinding.message }

  const { getGlobalWorkspaceId } = await import("@/lib/settings")
  const globalId = await getGlobalWorkspaceId()
  return db.$transaction(async (tx) => {
    // All self-service entry points lock the account before counting or claiming.
    const account = await tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM users WHERE id = ${userId} FOR UPDATE
    `
    if (account.length === 0) return { ok: false as const, error: "Akun tidak ditemukan." }

    const current = await countOwnedWorkspaces(tx, userId, globalId)
    if (current >= limit.max) {
      return {
        ok: false as const,
        error: `Batas workspace paket ${limit.planSlug} sudah tercapai (${current}/${limit.max}).`,
        limit: { ...limit, allowed: false, current },
      }
    }

    if (plan === "free") {
      const claim = await tx.user.updateMany({
        where: { id: userId, plan: "free", freeWorkspaceUsed: false },
        data: { freeWorkspaceUsed: true },
      })
      if (claim.count === 0) return { ok: false as const, error: "Jatah Workspace Gratis tidak tersedia untuk akun ini." }
    }

    return { ok: true as const, value: await create(tx) }
  })
}
