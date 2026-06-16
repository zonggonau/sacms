import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import NewSingleTypeClient from "./new-single-type-client"

export default async function NewSingleTypePage({
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
    <NewSingleTypeClient tenantSlug={tenantSlug} />
  )
}
