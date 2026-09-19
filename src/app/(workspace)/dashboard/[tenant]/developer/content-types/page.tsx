import { redirect } from "next/navigation"

export default async function ContentTypesAliasPage({
  params,
}: {
  params: Promise<{ tenant: string }>
}) {
  const { tenant } = await params
  redirect(`/dashboard/${tenant}/developer/conten-type`)
}
