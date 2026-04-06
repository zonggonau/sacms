import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/database"
import { redirect } from "next/navigation"
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
      tenant: true
    }
  })

  // Allowed CMS Roles: owner, admin, editor, contributor, viewer
  const allowedRoles = ["owner", "admin", "editor", "contributor", "viewer"]
  
  if (!membership || !allowedRoles.includes(membership.role)) {
    redirect("/dashboard")
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
