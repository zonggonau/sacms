import { GlobalSidebar } from "@/components/dashboard/global-sidebar"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { Metadata } from "next"
import { db } from "@/lib/database"

export const metadata: Metadata = {
  title: "Dashboard | SaCMS",
  description: "Global Dashboard",
}

export default async function GlobalDashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerSession(authOptions)
  
  // Fetch brand name from footer content entry
  let brandName = ""
  try {
    const footerEntry = await db.contentEntry.findFirst({
      where: { contentType: { slug: "sacms-footer" }, status: "PUBLISHED" },
      select: { data: true }
    })
    if (footerEntry?.data) {
      const data = typeof footerEntry.data === 'string' ? JSON.parse(footerEntry.data) : footerEntry.data
      brandName = data.brand_name || ""
    }
  } catch (e) {
    console.error("Failed to fetch brand name", e)
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <GlobalSidebar session={session} brandName={brandName} />
      <div className="flex-1 overflow-y-auto flex flex-col bg-background text-foreground relative">
        <main className="flex-1 p-6 md:p-10 w-full">
          {children}
        </main>
      </div>
    </div>
  )
}

