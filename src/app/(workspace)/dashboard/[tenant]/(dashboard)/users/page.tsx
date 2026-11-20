import { getTenantUsersAction } from "@/actions/users"

import { UsersClient } from "./users-client"
import { enforcePlanLimit } from "@/lib/plan-enforcement"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getTenantAccess } from "@/lib/tenant-access"
import { db } from "@/lib/database"

export default async function TenantUsersPage({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant } = await params
  
  const session = await getServerSession(authOptions)
  const access = session ? await getTenantAccess(session, tenant) : null
  
  const usersData = await getTenantUsersAction(tenant)
  
  if (usersData.error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Error</h2>
          <p className="text-muted-foreground">{usersData.error}</p>
        </div>
      </div>
    )
  }

  let maxLimit = 5
  let currentUsageCount = 0
  let primaryOwnerId: string | null = null
  if (access) {
    const [enforcement, workspace] = await Promise.all([
      enforcePlanLimit(access.tenantId, "team_members"),
      db.tenant.findUnique({ where: { id: access.tenantId }, select: { ownerId: true } }),
    ])
    maxLimit = enforcement.max
    currentUsageCount = enforcement.current
    primaryOwnerId = workspace?.ownerId ?? null
  }

  // Safely map members since we know the shape returned by the action
  const initialMembers = (usersData.members || []).map(m => ({
    ...m,
    joinedAt: m.joinedAt instanceof Date ? m.joinedAt.toISOString() : (m.joinedAt ? String(m.joinedAt) : new Date().toISOString()),
  }))

  return (
    <UsersClient 
      initialMembers={initialMembers as any} 
      tenantSlug={tenant} 

      limit={maxLimit}
      current={currentUsageCount}
      staffRole={access?.role ?? "viewer"}
      primaryOwnerId={primaryOwnerId}
    />
  )
}
