import { redirect } from "next/navigation"

export default async function ContentBuilderPage({
  params,
}: {
  params: Promise<{ tenant: string }>
}) {
  const resolvedParams = await params
  redirect(`/dashboard/${resolvedParams.tenant}/content-type-builder/content-types`)
}
