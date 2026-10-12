import { getApiTokensAction } from "@/actions/api-keys"
import { ApiKeysClient } from "./api-keys-client"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/database"
import { getTenantAccess } from "@/lib/tenant-access"
import { redirect } from "next/navigation"

export default async function TenantApiKeysPage({ params }: { params: Promise<{ tenant: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect("/login")

  const { tenant: tenantSlug } = await params
  const access = await getTenantAccess(session, tenantSlug)
  if (!access) redirect("/dashboard")

  const tenant = access.tenant

  const [tokensData, settings, legacyApiKeys, mcpTokens] = await Promise.all([
    getApiTokensAction(tenantSlug),
    db.setting.findMany({
      where: {
        OR: [{ tenantId: tenant.id }, { tenantId: null }]
      }
    }),
    // Legacy singleton credential (pre-dates the multi-token ApiToken model).
    // Always full-access, with no expiry/permission granularity — surfaced
    // here (masked, revoke-only) so it's no longer an invisible, unmanageable
    // live credential. Never mint new ones from this UI; only /api/tenant/
    // [tenant]/api-keys (used nowhere else now) can still rotate it.
    db.apiKey.findMany({
      where: { tenantId: tenant.id },
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, createdAt: true, expiresAt: true },
    }),
    // MCP token — separate from the REST/GraphQL API keys above (only
    // type "mcp" rows authenticate against the MCP server, see
    // api/mcp/[[...transport]]/route.ts's resolveToken()). Managed from
    // this page's "MCP Token" tab now, not from /developer/mcp anymore.
    db.apiToken.findMany({
      where: { tenantId: tenant.id, type: "mcp" },
      select: { id: true, name: true, description: true, type: true, createdAt: true, lastUsedAt: true },
      orderBy: { createdAt: "desc" },
    }),
  ])

  const settingsMap: Record<string, string> = {}
  settings.forEach((s) => {
    settingsMap[s.key] = s.value
  })

  const initialSettings = {
    tenantId: tenant.id,
    apiVersion: settingsMap.apiVersion || "v1",
    rateLimiting: settingsMap.rateLimiting !== "false",
    requestsPerMinute: settingsMap.requestsPerMinute || "60",
    burstLimit: settingsMap.burstLimit || "100",
    corsOrigins: settingsMap.corsOrigins || "",
  }

  return (
    <ApiKeysClient
      initialTokens={(tokensData.tokens as any) || []}
      legacyApiKeys={legacyApiKeys.map(k => ({
        id: k.id,
        name: k.name,
        createdAt: k.createdAt,
        expiresAt: k.expiresAt,
      }))}
      initialMcpTokens={mcpTokens.map(t => ({
        id: t.id,
        name: t.name,
        description: t.description,
        createdAt: t.createdAt.toISOString(),
        lastUsedAt: t.lastUsedAt ? t.lastUsedAt.toISOString() : null,
      }))}
      tenantSlug={tenantSlug}
      initialSettings={initialSettings}
    />
  )
}