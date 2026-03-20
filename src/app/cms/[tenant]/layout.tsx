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
  const { tenant: tenantSlug } = await params

  if (!session?.user) {
    redirect("/login")
  }

  // Check if user has access to this tenant and allowed CMS roles
  const membership = await db.tenantMember.findFirst({
    where: {
      tenant: { slug: tenantSlug },
      userId: session.user.id,
    },
  })

  // Allowed CMS Roles: owner, admin, editor, contributor, viewer
  // In your system, owner/admin can also access CMS.
  const allowedRoles = ["owner", "admin", "editor", "contributor", "viewer"]
  
  if (!membership || !allowedRoles.includes(membership.role)) {
    redirect("/dashboard")
  }

  return (
    <div className="flex min-h-screen">
      <CMSSidebar tenantSlug={tenantSlug} />
      <main className="flex-1 overflow-auto bg-muted/10">
        {children}
      </main>
    </div>
  )
}
