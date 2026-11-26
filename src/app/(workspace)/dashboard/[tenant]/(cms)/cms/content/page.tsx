import { redirect } from "next/navigation"

// There is no content index. Collections live under CMS Studio, so send
// /cms/content there instead of returning 404.
export default async function ContentIndexRedirect({
  params,
}: {
  params: Promise<{ tenant: string }>
}) {
  const { tenant } = await params
  redirect(`/dashboard/${tenant}/cms`)
}
