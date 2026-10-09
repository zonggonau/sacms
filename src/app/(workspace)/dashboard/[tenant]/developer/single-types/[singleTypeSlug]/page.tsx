import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"

export default async function SingleTypeDetailRedirectPage({
  params,
}: {
  params: Promise<{ tenant: string; singleTypeSlug: string }>
}) {
  const session = await getServerSession(authOptions)
  if (!session) {
    redirect("/login")
  }

  const { tenant, singleTypeSlug } = await params
  redirect(`/dashboard/${tenant}/cms/single-types/${singleTypeSlug}`)
}
