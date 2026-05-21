import { TenantSidebar } from "@/components/dashboard/tenant-sidebar"
import { Metadata } from "next"
import { db } from "@/lib/database"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tenant: string }>
}): Promise<Metadata> {
  const resolvedParams = await params
  
  try {
    const tenant = await db.tenant.findFirst({
      where: {
        OR: [{ id: resolvedParams.tenant }, { slug: resolvedParams.tenant }]
      },
      select: { name: true }
    })
    
    return {
      title: tenant ? `${tenant.name} | SaCMS` : "Workspace | SaCMS",
    }
  } catch (error) {
    return {
      title: "Workspace | SaCMS"
    }
  }
}

export default async function TenantDashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ tenant: string }>
}) {
  const resolvedParams = await params
  
  return (
    <div className="flex h-screen overflow-hidden bg-muted/20">
      <TenantSidebar tenantSlug={resolvedParams.tenant} />
      <div className="flex-1 overflow-y-auto flex flex-col bg-background text-foreground relative">
        {children}
      </div>
    </div>
  )
}
