import { getApiTokensAction } from "@/actions/api-keys"
import { ApiKeysClient } from "./api-keys-client"
import { redirect } from "next/navigation"

export default async function TenantApiKeysPage({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant } = await params
  
  const tokensData = await getApiTokensAction(tenant)
  
  if (tokensData.error) {
    // Or you could show an error state if preferred
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Error</h2>
          <p className="text-muted-foreground">{tokensData.error}</p>
        </div>
      </div>
    )
  }

  return <ApiKeysClient initialTokens={(tokensData.tokens as any) || []} tenantSlug={tenant} />
}