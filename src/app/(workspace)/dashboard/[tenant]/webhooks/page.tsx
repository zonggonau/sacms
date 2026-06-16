import { getWebhooksAction } from "@/actions/webhooks"
import { WebhooksClient } from "./webhooks-client"

export default async function TenantWebhooksPage({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant } = await params
  
  const webhooksData = await getWebhooksAction(tenant)
  
  if (webhooksData.error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Error</h2>
          <p className="text-muted-foreground">{webhooksData.error}</p>
        </div>
      </div>
    )
  }

  const initialWebhooks = (webhooksData.webhooks || []).map(w => ({
    ...w,
    createdAt: w.createdAt.toISOString(),
    lastTriggeredAt: w.lastTriggeredAt ? w.lastTriggeredAt.toISOString() : null
  }))

  return <WebhooksClient initialWebhooks={initialWebhooks as any} tenantSlug={tenant} />
}
