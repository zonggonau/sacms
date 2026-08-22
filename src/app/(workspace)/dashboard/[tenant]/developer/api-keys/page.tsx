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

  const [tokensData, settings, apiKeys] = await Promise.all([
    getApiTokensAction(tenantSlug),
    db.setting.findMany({
      where: {
        OR: [{ tenantId: tenant.id }, { tenantId: null }]
      }
    }),
    db.apiKey.findMany({
      where: { tenantId: tenant.id },
      orderBy: { createdAt: "desc" },
      take: 1
    })
  ])

  const settingsMap: Record<string, string> = {}
  settings.forEach((s) => {
    settingsMap[s.key] = s.value
  })

  const initialSettings = {
    tenantId: tenant.id,
    apiKey: apiKeys[0]?.key || "",
    apiVersion: settingsMap.apiVersion || "v1",
    rateLimiting: settingsMap.rateLimiting !== "false",
    requestsPerMinute: settingsMap.requestsPerMinute || "60",
    burstLimit: settingsMap.burstLimit || "100",
    corsOrigins: settingsMap.corsOrigins || "",
  }

  return (
    <ApiKeysClient 
      initialTokens={(tokensData.tokens as any) || []} 
      tenantSlug={tenantSlug} 
      initialSettings={initialSettings}
    />
  )
}