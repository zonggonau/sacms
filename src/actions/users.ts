"use server"

import { getServerSession } from "next-auth"
import { revalidatePath } from "next/cache"
import type { z } from "zod/v4"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/database"
import { getTenantAccess } from "@/lib/tenant-access"
import { isWorkspaceAdmin } from "@/lib/rbac/staff"
import {
  addWorkspaceStaff,
  addWorkspaceStaffSchema,
  removeWorkspaceStaff,
  updateWorkspaceStaff,
  updateWorkspaceStaffSchema,
  workspaceStaffUserSelect,
  WorkspaceStaffError,
} from "@/lib/workspace-staff"

export async function getTenantUsersAction(tenantSlug: string) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return { error: "Unauthorized" }
    const access = await getTenantAccess(session, tenantSlug)
    if (!access) return { error: "Forbidden" }
    const members = await db.tenantMember.findMany({
      where: { tenantId: access.tenantId },
      include: { user: { select: workspaceStaffUserSelect } },
      orderBy: { joinedAt: "asc" },
    })
    return { members }
  } catch (error) {
    console.error("Error fetching members:", error)
    return { error: "Internal server error" }
  }
}

async function mutateStaff<T>(
  tenantSlug: string,
  mutate: (tenantId: string, actor: { id: string; role: string }) => Promise<T>,
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return { error: "Unauthorized" }
    const access = await getTenantAccess(session, tenantSlug)
    if (!access || !isWorkspaceAdmin(access.role)) return { error: "Forbidden" }

    const result = await mutate(access.tenantId, session.user)
    revalidatePath(`/dashboard/${access.tenant.slug}/users`)
    return result
  } catch (error) {
    if (error instanceof WorkspaceStaffError) return { error: error.message }
    console.error("Error managing workspace staff:", error)
    return { error: "Internal server error" }
  }
}

export async function createMemberAction(tenantSlug: string, data: z.input<typeof addWorkspaceStaffSchema>) {
  const parsed = addWorkspaceStaffSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Validation failed" }
  return mutateStaff(tenantSlug, (tenantId, actor) => addWorkspaceStaff(tenantId, actor, parsed.data))
}

export async function updateMemberAction(
  tenantSlug: string,
  memberId: string,
  data: z.input<typeof updateWorkspaceStaffSchema>,
) {
  const parsed = updateWorkspaceStaffSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Validation failed" }
  return mutateStaff(tenantSlug, async (tenantId, actor) => {
    await updateWorkspaceStaff(tenantId, actor, memberId, parsed.data)
    return { success: true }
  })
}

export async function deleteMemberAction(tenantSlug: string, memberId: string) {
  return mutateStaff(tenantSlug, async (tenantId, actor) => {
    await removeWorkspaceStaff(tenantId, actor, memberId)
    return { success: true }
  })
}
