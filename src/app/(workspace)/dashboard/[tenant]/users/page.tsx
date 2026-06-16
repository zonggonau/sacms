import { getTenantUsersAction } from "@/actions/users"
import { getRolesAction } from "@/actions/roles"
import { UsersClient } from "./users-client"

export default async function TenantUsersPage({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant } = await params
  
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
    />
  )
}
