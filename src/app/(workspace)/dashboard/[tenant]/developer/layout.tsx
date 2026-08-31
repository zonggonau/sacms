import type { Metadata } from "next"
import { DeveloperSidebar } from "@/components/dashboard/developer-sidebar"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/database"
import { redirect } from "next/navigation"
import { getTenantAccess } from "@/lib/tenant-access"
import { isEnterpriseTenant } from "@/lib/license"
import { SubscriptionGate } from "../(dashboard)/subscription-gate"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tenant: string }>
}): Promise<Metadata> {
  const { tenant } = await params
  try {
    const t = await db.tenant.findFirst({
      where: { OR: [{ id: tenant }, { slug: tenant }] },
      select: { name: true },
    })
    return { title: t ? `Developer Portal — ${t.name} | SaCMS` : "Developer Portal | SaCMS" }
  } catch {
    return { title: "Developer Portal | SaCMS" }
  }
}

export default async function DeveloperLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ tenant: string }>
}) {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect("/login")

  const { tenant } = await params
  const access = await getTenantAccess(session, tenant)
  if (!access) redirect("/dashboard")

  const tenantId = access.tenantId
  const enterprise = await isEnterpriseTenant(tenantId, session.user.id)
  
  let isExpired = false
  if (!enterprise) {
    const [subscription, tenantData] = await Promise.all([
      db.subscription.findFirst({
        where: { tenantId },
        orderBy: { currentPeriodEnd: "desc" }
      }),
      db.tenant.findUnique({
        where: { id: tenantId },
        select: { status: true }
      })
    ])

    isExpired = tenantData?.status === "suspended" || 
      (subscription?.currentPeriodEnd ? new Date() > subscription.currentPeriodEnd : false)
  }

  return (
    <div className="flex min-h-screen w-full">
      <div className="sticky top-0 h-screen shrink-0">
        <DeveloperSidebar tenantId={tenant} />
      </div>
      <div className="flex-1 min-w-0">
        <SubscriptionGate isExpired={isExpired} tenantId={tenantId}>
          {children}
        </SubscriptionGate>
      </div>
    </div>
  )
}
