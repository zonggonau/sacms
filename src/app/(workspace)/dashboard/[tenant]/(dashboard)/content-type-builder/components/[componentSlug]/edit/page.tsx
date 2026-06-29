import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"

export default async function EditComponentPage({
  params,
}: {
  params: Promise<{ tenant: string; componentSlug: string }>
}) {
  const session = await getServerSession(authOptions)
  if (!session) {
    redirect("/login")
  }

  const resolvedParams = await params
  const tenantSlug = resolvedParams.tenant
  const componentSlug = resolvedParams.componentSlug

  redirect(`/dashboard/${tenantSlug}/components/${componentSlug}`)
}
