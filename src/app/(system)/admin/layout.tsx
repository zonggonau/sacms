import { GlobalAdminSidebar } from "@/components/dashboard/global-admin-sidebar"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"

/** Platform roles allowed into the admin portal. */
const ADMIN_PORTAL_ROLES = ["super_admin", "admin", "employee", "karyawan"]

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    redirect("/login")
  }

  if (!ADMIN_PORTAL_ROLES.includes(session.user.role)) {
    redirect("/dashboard")
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <GlobalAdminSidebar />
      <div className="flex-1 flex flex-col w-full h-full overflow-y-auto text-foreground relative pt-14 md:pt-0">
        {children}
      </div>
    </div>
  )
}
