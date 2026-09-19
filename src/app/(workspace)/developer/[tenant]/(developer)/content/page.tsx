import { redirect } from "next/navigation"

export default async function ContentRedirectPage({
  params,
}: {
  params: Promise<{ tenant: string }>
}) {
  const resolvedParams = await params
  redirect(`/cms/${resolvedParams.tenant}`)
}
