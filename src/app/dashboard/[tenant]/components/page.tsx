import { getComponentsAction } from "@/actions/components"
import { ComponentsClient } from "./components-client"
import { redirect } from "next/navigation"

export default async function ComponentsPage({
  params,
}: {
  params: Promise<{ tenant: string }>
}) {
  const { tenant } = await params

  const response = await getComponentsAction(tenant)

  if (response.error) {
    if (response.error === "Unauthorized") redirect("/login")
    return (
      <div className="flex-1 min-h-screen flex items-center justify-center flex-col w-full">
        <p className="text-destructive font-bold">{response.error}</p>
      </div>
    )
  }

  return <ComponentsClient initialComponents={response.components || []} tenantSlug={tenant} />
}
