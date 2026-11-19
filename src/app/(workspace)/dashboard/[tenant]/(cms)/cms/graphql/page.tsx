import { redirect } from "next/navigation"

export default async function LegacyGraphQLPlaygroundPage({
  params,
}: {
  params: Promise<{ tenant: string }>
}) {
  const { tenant } = await params
  redirect(`/dashboard/${encodeURIComponent(tenant)}/developer/api?tab=graphql`)
}
