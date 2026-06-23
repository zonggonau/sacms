import { getRolesAction } from "@/actions/roles"
import { TenantRolesClient } from "./roles-client"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"

export default async function RolesPage(
  props: { params: Promise<{ tenant: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    redirect("/login")
  }

  const { tenant: tenantSlug } = await props.params

  const result = await getRolesAction(tenantSlug)
  
  if (result.error) {
    return (
      <div className="flex-1 p-8">
        <h1 className="text-2xl font-bold text-destructive">Error</h1>
        <p className="text-muted-foreground">{result.error}</p>
      </div>
    )
  }

  return <TenantRolesClient initialRoles={result.roles || []} tenantSlug={tenantSlug} />
}
