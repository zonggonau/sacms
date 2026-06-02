import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/database"
import { redirect, notFound } from "next/navigation"
import { CMSSidebar } from "@/components/cms/cms-sidebar"

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
  // Support both ID and Slug for membership lookup
  const membership = await db.tenantMember.findFirst({
    where: {
      userId: session.user.id,
      OR: [
        { tenantId: tenantIdOrSlug },
        { tenant: { slug: tenantIdOrSlug } }
      ]
    },
    include: {
      tenant: {
        include: {
          subscriptions: {
            where: { status: { in: ["active", "trialing"] } },
            orderBy: { currentPeriodEnd: "desc" },
            take: 1
          }
        }
      }
    }
  })

  // Allowed CMS Roles: owner, admin, editor, contributor, viewer
  const allowedRoles = ["owner", "admin", "editor", "contributor", "viewer"]
  
  if (!membership) {
    // Fallback: If they mistyped the tenant slug, redirect to their first available tenant
    const fallbackMembership = await db.tenantMember.findFirst({
      where: { userId: session.user.id },
      include: { tenant: true }
    })
    
    if (fallbackMembership) {
      redirect(`/cms/${fallbackMembership.tenant.slug || fallbackMembership.tenant.id}`)
    }
    
    redirect("/dashboard")
  }

  if (!allowedRoles.includes(membership.role)) {
    notFound()
  }

  const tenant = membership.tenant
  
  if (tenant.status === 'suspended') {
    redirect(`/dashboard/${tenant.id}/subscriptions?suspended=true`)
  }

  if (tenant.plan === 'trial') {
    const sub = tenant.subscriptions?.[0]
    if (!sub || (sub.currentPeriodEnd && new Date(sub.currentPeriodEnd).getTime() <= Date.now())) {
      redirect(`/dashboard/${tenant.id}/subscriptions?expired=true`)
    }
  }

  // Use the canonical tenant ID for the sidebar and subsequent paths
  const tenantId = membership.tenant.id

  return (
    <div className="flex min-h-screen">
      <CMSSidebar tenantId={tenantId} />
      <main className="flex-1 overflow-auto bg-muted/10">
        {children}
      </main>
    </div>
  )
}
