import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db, getTenantDb } from "@/lib/database"
import { redirect, notFound } from "next/navigation"
import { CMSSidebar } from "@/components/cms/cms-sidebar"
import { getTenantAccess } from "@/lib/tenant-access"
import { isEnterpriseTenant } from "@/lib/license"

export default async function CMSLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ tenant: string }>
}) {
  const session = await getServerSession(authOptions)
  const { tenant: tenantIdOrSlug } = await params

  if (!session?.user) {
    redirect("/login")
  }

  // Check if user has access to this tenant and allowed CMS roles
  const access = await getTenantAccess(session, tenantIdOrSlug)

  // Allowed CMS Roles: owner, admin, editor, author, contributor, subscriber, viewer, user, member
  const allowedRoles = ["owner", "admin", "editor", "author", "contributor", "subscriber", "viewer", "user", "member"]
  
  if (!access) {
    // Fallback: If they mistyped the tenant slug, redirect to their first available tenant
    const fallbackMembership = await db.tenantMember.findFirst({
      where: { userId: session.user.id },
      include: { tenant: true }
    })
    
    if (fallbackMembership) {
      redirect(`/dashboard/${fallbackMembership.tenant.slug || fallbackMembership.tenant.id}/cms`)
    }
    
    redirect("/dashboard")
  }

  if (!allowedRoles.includes(access.role)) {
    notFound()
  }

  const tenant = access.tenant
  const tenantId = tenant.id
  
  const enterprise = await isEnterpriseTenant(tenantId, session.user.id)
  
  if (!enterprise) {
    const tenantData = await db.tenant.findUnique({
      where: { id: tenantId },
      select: { status: true }
    })
    
    if (tenantData?.status === 'suspended') {
      redirect(`/dashboard/${tenantId}/subscriptions?suspended=true`)
    }

    if (tenant.plan === 'trial') {
      const sub = await db.subscription.findFirst({
        where: { tenantId: tenantId },
        orderBy: { currentPeriodEnd: "desc" }
      })
      if (!sub || (sub.currentPeriodEnd && new Date(sub.currentPeriodEnd).getTime() <= Date.now())) {
        redirect(`/dashboard/${tenantId}/subscriptions?expired=true`)
      }
    }
  }

  // Fetch content types directly in Server Component
  const tenantDb = await getTenantDb(tenantId)
  const availableContentTypes = await tenantDb.contentType.findMany({
    where: {
      showInCms: true,
      OR: [
        { tenantId: tenantId },
        {
          tenants: {
            some: {
              tenantId: tenantId,
              enabled: true
            }
          }
        },
        ...(access.isGlobal ? [{ tenantId: null }] : [])
      ]
    },
    select: { id: true, name: true, slug: true },
    orderBy: { updatedAt: "desc" },
  })

  const availableSingleTypes = await tenantDb.singleType.findMany({
    where: {
      showInCms: true,
      OR: [
        { tenantId: tenantId },
        {
          tenants: {
            some: {
              tenantId: tenantId,
              enabled: true
            }
          }
        },
        ...(access.isGlobal ? [{ tenantId: null }] : [])
      ]
    },
    select: { id: true, name: true, slug: true },
    orderBy: { updatedAt: "desc" },
  })

  return (
    <div className="flex min-h-screen">
      <CMSSidebar 
        tenantId={tenantId} 
        contentTypes={availableContentTypes} 
        singleTypes={availableSingleTypes} 
        user={session.user}
        userRole={access.role}
      />
      <main className="flex-1 overflow-auto bg-muted/10">
        {children}
      </main>
    </div>
  )
}
