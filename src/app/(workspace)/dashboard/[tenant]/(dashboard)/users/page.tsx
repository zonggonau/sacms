import { getTenantUsersAction } from "@/actions/users"
import { getRolesAction } from "@/actions/roles"
import { UsersClient } from "./users-client"
import { enforcePlanLimit } from "@/lib/plan-enforcement"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getTenantAccess } from "@/lib/tenant-access"

export default async function TenantUsersPage({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant } = await params
  
  const session = await getServerSession(authOptions)
  const access = session ? await getTenantAccess(session, tenant) : null
  
  const [usersData, rolesData] = await Promise.all([
    getTenantUsersAction(tenant),
    getRolesAction(tenant)
  ])
  
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
  if (access) {
    const enforcement = await enforcePlanLimit(access.tenantId, "team_members")
    maxLimit = enforcement.max
    currentUsageCount = enforcement.current
  }

  // Safely map members since we know the shape returned by the action
  const initialMembers = (usersData.members || []).map(m => ({
    ...m,
    joinedAt: m.joinedAt.toISOString(),
  }))

  return (
    <UsersClient 
      initialMembers={initialMembers as any} 
      tenantSlug={tenant} 
      customRoles={rolesData.roles || []} 
      limit={maxLimit}
      current={currentUsageCount}
    />
  )
}
