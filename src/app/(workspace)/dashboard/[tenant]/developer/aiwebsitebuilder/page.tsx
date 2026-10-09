import { AiWebsiteBuilderClient } from "./builder-client"

export default async function AiWebsiteBuilderPage({
  params,
}: {
  params: Promise<{ tenant: string }>
}) {
  const { tenant } = await params

  return <AiWebsiteBuilderClient tenantSlug={tenant} />
}
