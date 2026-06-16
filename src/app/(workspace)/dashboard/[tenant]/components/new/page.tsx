import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import NewComponentClient from "./new-component-client"

export default async function NewComponentPage({
  params,
}: {
  params: Promise<{ tenant: string }>
}) {
  const session = await getServerSession(authOptions)
  if (!session) {
    redirect("/login")
  }

  const resolvedParams = await params
  const tenantSlug = resolvedParams.tenant

  return (
    <NewComponentClient tenantSlug={tenantSlug} />
  )
}
