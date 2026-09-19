import { redirect } from "next/navigation"

export default async function ContentTypesRedirectPage({
  params,
}: {
  params: Promise<{ tenant: string }>
}) {
  const resolvedParams = await params
  redirect(`/developer/${resolvedParams.tenant}/content-type-builder/content-types`)
}
