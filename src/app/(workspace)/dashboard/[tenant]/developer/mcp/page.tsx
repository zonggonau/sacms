import { redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/database"
import { getTenantAccess } from "@/lib/tenant-access"
import { MCPDashboardClient } from "./mcp-client"

export default async function MCPPage({ params }: { params: Promise<{ tenant: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect("/login")

  const { tenant: tenantSlug } = await params
  const access = await getTenantAccess(session, tenantSlug)
  if (!access) redirect("/dashboard")

  const tenant = access.tenant

  // Fetch existing API tokens for this tenant (both read-only and full-access for CRUD)
  const tokens = await db.apiToken.findMany({
    where: { tenantId: tenant.id },
    select: { id: true, name: true, description: true, type: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: 10,
  })

  return (
    <MCPDashboardClient
      tenantSlug={tenantSlug}
      tenantId={tenant.id}
      existingTokens={tokens.map(t => ({ 
        id: t.id, 
        name: t.name, 
        type: t.type,
        description: t.description, 
        createdAt: t.createdAt.toISOString() 
      }))}
    />
  )
}
