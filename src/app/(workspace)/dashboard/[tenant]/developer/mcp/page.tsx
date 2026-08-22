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

  // Fetch existing tokens and keys for this tenant
  const [tokens, apiKeys] = await Promise.all([
    db.apiToken.findMany({
      where: { tenantId: tenant.id },
      select: { id: true, name: true, description: true, type: true, token: true, createdAt: true, lastUsedAt: true },
      orderBy: { createdAt: "desc" },
    }),
    db.apiKey.findMany({
      where: { tenantId: tenant.id },
      select: { id: true, name: true, key: true, createdAt: true, lastUsed: true },
      orderBy: { createdAt: "desc" },
    })
  ])

  return (
    <MCPDashboardClient
      tenantSlug={tenantSlug}
      tenantId={tenant.id}
      existingTokens={tokens.map(t => ({ 
        id: t.id, 
        name: t.name, 
        type: t.type,
        token: t.token,
        description: t.description, 
        createdAt: t.createdAt.toISOString(),
        lastUsedAt: t.lastUsedAt ? t.lastUsedAt.toISOString() : null,
      }))}
      existingApiKeys={apiKeys.map(k => ({
        id: k.id,
        name: k.name || "API Key",
        key: k.key,
        createdAt: k.createdAt.toISOString(),
        lastUsed: k.lastUsed ? k.lastUsed.toISOString() : null,
      }))}
    />
  )
}
