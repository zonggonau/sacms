import { isEnterpriseMode } from "@/lib/license"
import { redirect } from "next/navigation"

export default async function SubscriptionsLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ tenant: string }>
}) {
  const enterprise = await isEnterpriseMode()
  if (enterprise) {
    const resolvedParams = await params
    redirect(`/dashboard/${resolvedParams.tenant}`)
  }
  return <>{children}</>
}
