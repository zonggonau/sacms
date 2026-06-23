import { redirect } from "next/navigation"
import { isEnterpriseTenant } from "@/lib/license"

export default async function SubscriptionsLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ tenant: string }>
}) {
  const { tenant } = await params
  const isEnterprise = await isEnterpriseTenant(tenant)

  if (isEnterprise) {
    const resolvedParams = await params
    redirect(`/dashboard/${resolvedParams.tenant}`)
  }
  return <>{children}</>
}
