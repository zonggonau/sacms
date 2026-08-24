import { TenantSidebar } from "@/components/dashboard/tenant-sidebar"
import { Metadata } from "next"
import { db } from "@/lib/database"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import { getTenantAccess } from "@/lib/tenant-access"
import { isEnterpriseTenant } from "@/lib/license"
import { SubscriptionGate } from "./subscription-gate"
import { DashboardLayoutShell } from "@/components/dashboard/dashboard-layout-shell"

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
        <TenantSidebar tenantSlug="account" session={session} />
        <div className="flex-1 overflow-y-auto flex flex-col bg-background text-foreground relative pt-14 md:pt-0">
          {children}
        </div>
      </div>
    )
  }

  const access = await getTenantAccess(session, resolvedParams.tenant)
  
  if (!access) {
    const fallbackMembership = await db.tenantMember.findFirst({
      where: { userId: session.user.id },
      include: { tenant: true }
    })
    
    if (fallbackMembership) {
      redirect(`/dashboard/${fallbackMembership.tenant.slug || fallbackMembership.tenant.id}`)
    }
    redirect("/dashboard")
  }

  // Only owners, admins, and super_admins can access the management dashboard.
  // Editors, authors, contributors, viewers, and subscribers must go to the CMS content studio.
  const isManagementAdmin = access.role === "owner" || access.role === "admin" || session.user.role === "super_admin"
  if (!isManagementAdmin) {
    redirect(`/dashboard/${access.tenant.slug || access.tenant.id}/cms`)
  }

  // Check trial / subscription expiration and suspension status
  const [subscription, tenantData] = await Promise.all([
    db.subscription.findFirst({
      where: { tenantId: access.tenantId },
      orderBy: { currentPeriodEnd: "desc" }
    }),
    db.tenant.findUnique({
      where: { id: access.tenantId },
      select: { status: true }
    })
  ])

  // Enterprise mode bypasses subscription checks
  const enterprise = await isEnterpriseTenant(access.tenantId, session.user.id)
  const isExpired = enterprise ? false : (
    tenantData?.status === "suspended" || 
    (subscription?.currentPeriodEnd ? new Date() > subscription.currentPeriodEnd : false)
  );
  
  return (
    <DashboardLayoutShell
      sidebar={
        <TenantSidebar tenantSlug={resolvedParams.tenant} isEnterpriseMode={enterprise} session={session} />
      }
      subscriptionGate={
        <SubscriptionGate isExpired={isExpired} tenantId={access.tenantId}>
          {children}
        </SubscriptionGate>
      }
    />
  )
}
