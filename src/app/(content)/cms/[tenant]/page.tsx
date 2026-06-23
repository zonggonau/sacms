import { redirect } from "next/navigation"

export default async function CMSTenantRedirect({
  params,
}: {
  params: Promise<{ tenant: string }>
}) {
  const { tenant } = await params
  redirect(`/dashboard/${tenant}/cms`)
}
