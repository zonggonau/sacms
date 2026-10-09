import { redirect } from "next/navigation"

export default async function APIDocsPage({
  params,
}: {
  params: Promise<{ tenant: string }>
}) {
  const { tenant } = await params
  redirect(`/dashboard/${tenant}/developer/api?tab=swagger`)
}
