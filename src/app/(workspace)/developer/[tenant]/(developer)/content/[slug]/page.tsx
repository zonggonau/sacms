import { redirect } from "next/navigation"

export default async function ContentSlugRedirectPage({
  params,
}: {
  params: Promise<{ tenant: string; slug: string }>
}) {
  const resolvedParams = await params
  redirect(`/cms/${resolvedParams.tenant}/content/${resolvedParams.slug}`)
}
