import { redirect } from "next/navigation"

export default async function DeveloperRootPage({
  params,
}: {
  params: Promise<{ tenant: string }>
}) {
  const { tenant } = await params
  redirect(`/dashboard/${tenant}/developer/api-keys`)
}
