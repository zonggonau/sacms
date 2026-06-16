import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import ComponentDetailClient from "./component-detail-client"
import { getComponentBySlugAction } from "@/actions/components"

export default async function ComponentDetailPage({
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

  let initialComponent = null

  try {
    const response = await getComponentBySlugAction(tenantSlug, componentSlug)
    if (response.component) {
      initialComponent = response.component
    }
  } catch (error) {
    console.error("Failed to fetch component for detail page:", error)
  }

  return (
    <ComponentDetailClient
      tenantSlug={tenantSlug}
      componentSlug={componentSlug}
      initialComponent={initialComponent}
    />
  )
}
