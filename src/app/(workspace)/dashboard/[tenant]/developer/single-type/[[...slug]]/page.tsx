import { redirect } from "next/navigation"

export default async function LegacyRedirectPage({
  params,
}: {
  params: Promise<{ tenant: string; slug?: string[] }>
}) {
  const { tenant, slug } = await params
  const targetSubpath = slug && slug.length > 0 ? `/${slug.join("/")}` : ""
  redirect(`/dashboard/${tenant}/developer/single-types${targetSubpath}`)
}
