import { ContentBuilderSidebar } from "@/components/dashboard/content-builder-sidebar"

export default async function ContentBuilderLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ tenant: string }>
}) {
  const resolvedParams = await params
  
  return (
    <div className="flex h-full w-full flex-1 overflow-hidden">
      <ContentBuilderSidebar tenantId={resolvedParams.tenant} />
      <div className="flex-1 overflow-y-auto">
        {children}
      </div>
    </div>
  )
}
