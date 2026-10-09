import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"

export default async function ContentTypeEntriesRedirectPage({ 
  params 
}: { 
  params: Promise<{ tenant: string; slug: string }> 
}) {
  const session = await getServerSession(authOptions)
  if (!session) {
    redirect("/login")
  }

  const { tenant, slug } = await params
  redirect(`/dashboard/${tenant}/cms/content/${slug}`)
}
