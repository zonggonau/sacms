import { redirect } from "next/navigation"
import { isEnterpriseTenant } from "@/lib/license"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export default async function SubscriptionsLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ tenant: string }>
}) {
  const { tenant } = await params
  const session = await getServerSession(authOptions)
  const isEnterprise = await isEnterpriseTenant(tenant, session?.user?.id)

  if (isEnterprise) {
    const resolvedParams = await params
    redirect(`/dashboard/${resolvedParams.tenant}`)
  }
  return <>{children}</>
}
