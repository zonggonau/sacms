import { TenantSidebar } from "@/components/dashboard/tenant-sidebar"
import { Metadata } from "next"
import { db } from "@/lib/database"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import { getTenantAccess } from "@/lib/tenant-access"
import { SubscriptionGate } from "./subscription-gate"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tenant: string }>
}): Promise<Metadata> {
  const resolvedParams = await params
  
  try {
    const tenant = await db.tenant.findFirst({
      where: {
        OR: [{ id: resolvedParams.tenant }, { slug: resolvedParams.tenant }]
      },
      select: { name: true }
    })
    
    return {
      title: tenant ? `${tenant.name} | SaCMS` : "Workspace | SaCMS",
    }
  } catch (error) {
    return {
      title: "Workspace | SaCMS"
    }
  }
}

export default async function TenantDashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ tenant: string }>
}) {
  const resolvedParams = await params
  
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    redirect("/login")
  }

  if (resolvedParams.tenant === "account") {
    return (
      <div className="flex h-screen overflow-hidden bg-muted/20">
        <TenantSidebar tenantSlug="account" />
        <div className="flex-1 overflow-y-auto flex flex-col bg-background text-foreground relative">
          {children}
        </div>
      </div>
    )
  }

  const access = await getTenantAccess(session, resolvedParams.tenant)
  
  if (!access) {
    redirect("/dashboard")
  }

  // Only owners and admins can access the dashboard.
  // Editors and viewers must go to the CMS content studio.
  if (access.role === "editor" || access.role === "viewer") {
    redirect(`/cms/${access.tenant.slug}`)
  }

  // Check trial / subscription expiration
  const subscription = await db.subscription.findFirst({
    where: { tenantId: access.tenantId },
    orderBy: { currentPeriodEnd: "desc" }
  })

  // If there is an end date and it's in the past, it is expired
  const isExpired = subscription?.currentPeriodEnd ? new Date() > subscription.currentPeriodEnd : false;
  
  return (
    <div className="flex h-screen overflow-hidden bg-muted/20">
      <TenantSidebar tenantSlug={resolvedParams.tenant} />
      <div className="flex-1 overflow-y-auto flex flex-col bg-background text-foreground relative">
        <SubscriptionGate isExpired={isExpired} tenantId={access.tenantId}>
          {children}
        </SubscriptionGate>
      </div>
    </div>
  )
}
