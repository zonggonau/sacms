import { redirect } from "next/navigation"

export default async function LegacyWebsiteBuilderPage({
  params,
}: {
  params: Promise<{ tenant: string }>
}) {
  const { tenant: tenantSlug } = await params
  redirect(`/dashboard/ai-builder?workspace=${tenantSlug}`)
}
