import { redirect } from "next/navigation"

export default async function ApiKeysRedirectPage({
  params,
}: {
  params: Promise<{ tenant: string }>
}) {
  const resolvedParams = await params
  redirect(`/developer/${resolvedParams.tenant}/tools/api-keys`)
}
