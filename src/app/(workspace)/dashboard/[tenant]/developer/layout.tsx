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
    <div className="flex min-h-screen w-full">
      <div className="sticky top-0 h-screen shrink-0">
        <DeveloperSidebar tenantId={tenant} />
      </div>
      <div className="flex-1 min-w-0">
        {children}
      </div>
    </div>
  )
}
