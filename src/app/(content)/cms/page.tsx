import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/database"
import { redirect } from "next/navigation"

export default async function CMSIndexPage() {
  const session = await getServerSession(authOptions)
  
  if (!session?.user) {
    redirect("/login")
  }

  // Find the first workspace where the user has a CMS role
  const allowedRoles = ["owner", "admin", "editor", "contributor", "viewer"]
  
  const membership = await db.tenantMember.findFirst({
    where: {
      userId: session.user.id,
      role: { in: allowedRoles }
    },
    include: { tenant: true },
    orderBy: { createdAt: "desc" }
  })

  if (membership) {
    redirect(`/dashboard/${membership.tenant.slug || membership.tenant.id}/cms`)
  }

  // If no CMS access anywhere, send them to dashboard
  redirect("/dashboard")
}
