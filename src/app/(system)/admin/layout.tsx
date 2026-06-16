import { GlobalAdminSidebar } from "@/components/dashboard/global-admin-sidebar"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerSession(authOptions)

  if (!session?.user || !["super_admin", "admin", "employee", "karyawan"].includes(session.user.role)) {
    redirect("/dashboard")
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
