import { TenantSidebar } from "@/components/dashboard/tenant-sidebar"
import { Metadata } from "next"
import { db } from "@/lib/database"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"

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
  
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    redirect("/login")
  }

  // Allow super_admin or admin to access any dashboard
  if (session.user.role !== "super_admin" && session.user.role !== "admin") {
    // For regular users, check their role in this specific tenant
    const tenantAccess = session.user.tenants?.find(
      (t: any) => t.id === resolvedParams.tenant || t.slug === resolvedParams.tenant
    )

    if (!tenantAccess) {
      redirect("/dashboard")
    }

    // Only owners and admins can access the dashboard.
    // Editors and viewers must go to the CMS content studio.
    if (tenantAccess.role === "editor" || tenantAccess.role === "viewer") {
      redirect(`/cms/${tenantAccess.slug}`)
    }
  }
  
  return (
    <div className="flex h-screen overflow-hidden bg-muted/20">
      <TenantSidebar tenantSlug={resolvedParams.tenant} />
      <div className="flex-1 overflow-y-auto flex flex-col bg-background text-foreground relative">
        {children}
      </div>
    </div>
  )
}
