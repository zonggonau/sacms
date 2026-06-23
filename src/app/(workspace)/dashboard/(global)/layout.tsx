import { GlobalSidebar } from "@/components/dashboard/global-sidebar"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { Metadata } from "next"

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
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <GlobalSidebar session={session} />
      <div className="flex-1 overflow-y-auto flex flex-col bg-background text-foreground relative">
        <main className="flex-1 p-6 md:p-10 w-full">
          {children}
        </main>
      </div>
    </div>
  )
}

