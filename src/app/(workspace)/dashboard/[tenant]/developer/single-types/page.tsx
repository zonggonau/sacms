import { redirect } from "next/navigation"

export default async function SingleTypesAliasPage({
  params,
}: {
  params: Promise<{ tenant: string }>
}) {
  const { tenant } = await params
  redirect(`/dashboard/${tenant}/developer/single-type`)
}
