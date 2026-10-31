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

  const tenantSummary = access.tenant

  // MCP token creation/regeneration/deletion happens at /developer/
  // api-keys' "MCP Token" tab — this page only needs to know WHETHER one
  // exists (its id, to key the sessionStorage hand-off in
  // src/lib/mcp-token-storage.ts) plus tenant/subscription status to
  // render the config/setup guides. The plaintext itself is never stored
  // server-side (only its SHA-256 hash), so it can't be fetched here.
  const [tenant, subscription, mcpToken, globalSchemaToken] = await Promise.all([
    db.tenant.findUnique({
      where: { id: tenantSummary.id },
      select: { id: true, name: true, slug: true, plan: true, status: true, hostingStatus: true },
    }),
    db.subscription.findFirst({
      where: { tenantId: tenantSummary.id },
      orderBy: { createdAt: "desc" },
    }),
    db.apiToken.findFirst({
      where: { tenantId: tenantSummary.id, type: "mcp" },
      select: { id: true, name: true },
      orderBy: { createdAt: "asc" },
    }),
    // Only the SaCMS Global workspace ever has one of these — see
    // src/app/api/mcp/global-schema and src/actions/mcp-tokens.ts.
    access.isGlobal
      ? db.apiToken.findFirst({
          where: { tenantId: tenantSummary.id, type: "mcp-global-schema" },
          select: { id: true, name: true },
          orderBy: { createdAt: "asc" },
        })
      : Promise.resolve(null),
  ])

  const currentStatus = tenant?.status ?? "active"
  const currentHostingStatus = tenant?.hostingStatus ?? null
  const currentPlan = tenant?.plan ?? tenantSummary.plan

  // Determine Paid & Hosting Plan status
  const isPaid = (currentStatus === "active" && (subscription?.status === "active" || subscription?.status === "paid" || subscription?.status === "trialing")) || currentHostingStatus === "active"

  return (
    <MCPDashboardClient
      tenantSlug={tenantSlug}
      tenantId={tenantSummary.id}
      plan={currentPlan}
      isPaid={isPaid}
      subscriptionStatus={subscription?.status || "inactive"}
      activeMcpToken={mcpToken ? { id: mcpToken.id, name: mcpToken.name } : null}
      isGlobal={access.isGlobal}
      activeGlobalSchemaToken={globalSchemaToken ? { id: globalSchemaToken.id, name: globalSchemaToken.name } : null}
    />
  )
}
