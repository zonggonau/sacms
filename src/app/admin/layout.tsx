import { GlobalAdminSidebar } from "@/components/dashboard/global-admin-sidebar"

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <GlobalAdminSidebar />
      <div className="flex-1 flex flex-col w-full h-full overflow-y-auto text-foreground relative">
        {children}
      </div>
    </div>
  )
}
