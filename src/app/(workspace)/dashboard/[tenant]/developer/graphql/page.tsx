import { redirect } from "next/navigation"

export default async function GraphQLPlaygroundPage({
  params,
}: {
  params: Promise<{ tenant: string }>
}) {
  const { tenant } = await params
  redirect(`/dashboard/${tenant}/developer/api?tab=graphql`)
}
