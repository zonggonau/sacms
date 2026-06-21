import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import { db } from "@/lib/database"
import { AdminCMSSidebar } from "@/components/admin-cms/admin-cms-sidebar"

export default async function AdminCMSLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerSession(authOptions)

  if (!session?.user || !["super_admin"].includes(session.user.role)) {
    redirect("/dashboard")
  }

  // Fetch global content types and single types
  const contentTypes = await db.contentType.findMany({
    where: { tenantId: null },
    select: { id: true, name: true, slug: true },
    orderBy: { updatedAt: "desc" },
  })

  const singleTypes = await db.singleType.findMany({
    where: { tenantId: null },
    select: { id: true, name: true, slug: true },
    orderBy: { updatedAt: "desc" },
  })

  return (
    <div className="flex min-h-[calc(100vh)]">
      <AdminCMSSidebar contentTypes={contentTypes} singleTypes={singleTypes} />
      <main className="flex-1 overflow-auto bg-muted/10 relative">
        {children}
      </main>
    </div>
  )
}
