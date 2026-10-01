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

  // Fetch existing tokens and subscription for this tenant. Only type "mcp"
  // rows are MCP credentials — the REST/GraphQL API key (any other type, or
  // the legacy ApiKey) is a separate system managed at /developer/api-keys
  // and no longer authenticates against the MCP server at all.
  const [tenant, tokens, subscription] = await Promise.all([
    db.tenant.findUnique({
      where: { id: tenantSummary.id },
      select: { id: true, name: true, slug: true, plan: true, status: true, hostingStatus: true },
    }),
    db.apiToken.findMany({
      where: { tenantId: tenantSummary.id, type: "mcp" },
      select: { id: true, name: true, description: true, type: true, createdAt: true, lastUsedAt: true },
      orderBy: { createdAt: "desc" },
    }),
    db.subscription.findFirst({
      where: { tenantId: tenantSummary.id },
      orderBy: { createdAt: "desc" },
    }),
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
      existingTokens={tokens.map(t => ({
        id: t.id,
        name: t.name,
        type: t.type,
        // ApiToken.token is stored as a SHA-256 hash (see actions/mcp-tokens.ts)
        // — never send it to the client. The real token is only ever shown
        // once, immediately after creation, via generatedPlainToken in
        // handleCreateToken. Intentionally omitted here, not just masked,
        // so nothing downstream can mistake the hash for a usable token.
        description: t.description,
        createdAt: t.createdAt.toISOString(),
        lastUsedAt: t.lastUsedAt ? t.lastUsedAt.toISOString() : null,
      }))}
    />
  )
}
