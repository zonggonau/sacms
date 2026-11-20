import { getApiTokensAction } from "@/actions/api-keys"
import { ApiKeysClient } from "./api-keys-client"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/database"
import { getTenantAccess } from "@/lib/tenant-access"
import { redirect } from "next/navigation"
import { getWorkspaceApiPolicy } from "@/lib/workspace-api-policy"

export default async function TenantApiKeysPage({ params }: { params: Promise<{ tenant: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect("/login")

  const { tenant: tenantSlug } = await params
  const access = await getTenantAccess(session, tenantSlug)
  if (!access) redirect("/dashboard")

  const tenant = access.tenant

  const [tokensData, policy, legacyApiKeys] = await Promise.all([
    getApiTokensAction(tenantSlug),
    getWorkspaceApiPolicy(tenant.id),
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
    // MCP token management lives on /developer/mcp now — nothing to
    // fetch here anymore (see mcp-client.tsx's self-contained token card).
  ])

  const initialSettings = {
    tenantId: tenant.id,
    rateLimiting: policy.rateLimiting,
    requestsPerMinute: String(policy.requestsPerMinute),
    burstLimit: String(policy.burstLimit),
    corsOrigins: policy.corsOrigins,
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
      tenantSlug={tenantSlug}
      initialSettings={initialSettings}
    />
  )
}
