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

  // Fetch existing tokens, keys, subscriptions, and infrastructure for this tenant
  const [tokens, apiKeys, subscription, vpsServer] = await Promise.all([
    db.apiToken.findMany({
      where: { tenantId: tenant.id },
      select: { id: true, name: true, description: true, type: true, token: true, createdAt: true, lastUsedAt: true },
      orderBy: { createdAt: "desc" },
    }),
    db.apiKey.findMany({
      where: { tenantId: tenant.id },
      select: { id: true, name: true, key: true, createdAt: true, lastUsed: true },
      orderBy: { createdAt: "desc" },
    }),
    db.subscription.findFirst({
      where: { tenantId: tenant.id },
      orderBy: { createdAt: "desc" },
    }),
    db.infrastructureServer.findFirst({
      where: { tenantId: tenant.id },
      orderBy: { createdAt: "desc" },
    }),
  ])

  // Determine Paid & Hosting Plan status
  const isPaid = (tenant.status === "active" && (subscription?.status === "active" || subscription?.status === "paid" || subscription?.status === "trialing")) || tenant.hostingStatus === "active"
  const isVpsPlan = tenant.plan.startsWith("vps-") || tenant.plan === "enterprise"
  const hostingType = isVpsPlan ? "dedicated_vps" : "shared_vercel"

  return (
    <MCPDashboardClient
      tenantSlug={tenantSlug}
      tenantId={tenant.id}
      plan={tenant.plan}
      isPaid={isPaid}
      hostingType={hostingType}
      subscriptionStatus={subscription?.status || "inactive"}
      vpsDetails={vpsServer ? {
        hostname: vpsServer.hostname || null,
        ipv4: vpsServer.ipv4 || null,
        status: vpsServer.status,
        plan: vpsServer.plan,
        cpuCount: vpsServer.cpuCount,
        ramMb: vpsServer.ramMb,
      } : null}
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
