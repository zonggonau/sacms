import { GlobalSidebar } from "@/components/dashboard/global-sidebar"
import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Dashboard | SaCMS",
  description: "Global Dashboard",
}

export default function GlobalDashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex h-screen overflow-hidden bg-muted/20">
      <GlobalSidebar />
      <div className="flex-1 overflow-y-auto flex flex-col bg-background text-foreground relative">
        {children}
      </div>
    </div>
  )
}
