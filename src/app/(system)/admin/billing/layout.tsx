import { BillingSubSidebar } from "@/components/admin/billing-sub-sidebar"

export default function AdminBillingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex h-full w-full overflow-hidden bg-background">
      <BillingSubSidebar />
      <div className="flex-1 flex flex-col w-full h-full overflow-y-auto">
        {children}
      </div>
    </div>
  )
}
