import { GlobalAdminSidebar } from "@/components/dashboard/global-admin-sidebar"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"

import { db } from "@/lib/database"

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    redirect("/login")
  }

  // Hardcoded built-in admins
  if (["super_admin", "admin"].includes(session.user.role)) {
    // allowed
  } else {
    // Check if the role is a dynamic SystemRole
    const systemRole = await db.systemRole.findUnique({
      where: { slug: session.user.role }
    })
    
    // Also support legacy tenant-level employee roles temporarily
    if (!systemRole && !["employee", "karyawan"].includes(session.user.role)) {
      redirect("/dashboard")
    }
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <GlobalAdminSidebar />
      <div className="flex-1 flex flex-col w-full h-full overflow-y-auto text-foreground relative">
        {children}
      </div>
    </div>
  )
}
