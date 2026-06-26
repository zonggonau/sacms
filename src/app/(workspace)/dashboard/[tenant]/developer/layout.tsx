import { DeveloperSidebar } from "@/components/dashboard/developer-sidebar"

export default async function DeveloperLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ tenant: string }>
}) {
  const { tenant } = await params

  return (
    <div className="flex flex-1 overflow-hidden h-full">
      <DeveloperSidebar tenantId={tenant} />
      <div className="flex-1 overflow-y-auto">
        {children}
      </div>
    </div>
  )
}
