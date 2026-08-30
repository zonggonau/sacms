import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"

export default async function NewEntryRedirectPage({
  params,
}: {
  params: Promise<{ tenant: string; slug: string }>
}) {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect("/login")

  const { tenant, slug } = await params
  redirect(`/dashboard/${tenant}/cms/content/${slug}/new`)
}
