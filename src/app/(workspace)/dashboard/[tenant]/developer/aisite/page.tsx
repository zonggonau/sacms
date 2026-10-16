import { redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getTenantDb } from "@/lib/database"
import { getTenantAccess } from "@/lib/tenant-access"
import { AiSiteProjectsClient } from "@/components/dashboard/ai-site/projects-client"

export default async function AiSiteProjectsPage({ params }: { params: Promise<{ tenant: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect("/login")

  const { tenant: tenantSlug } = await params
  const access = await getTenantAccess(session, tenantSlug)
  if (!access) redirect("/dashboard")

  const tenantDb = await getTenantDb(access.tenant.slug)
  const projects = await tenantDb.aiSiteProject.findMany({
    where: { tenantId: access.tenantId },
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { chats: true } } },
  })

  return (
    <div className="p-4 md:p-6 lg:p-8 w-full max-w-7xl mx-auto">
      <AiSiteProjectsClient
        tenantSlug={access.tenant.slug}
        tenantId={tenantSlug}
        initialProjects={projects.map((p) => ({
          id: p.id,
          name: p.name,
          description: p.description,
          updatedAt: p.updatedAt.toISOString(),
          chatCount: p._count.chats,
        }))}
      />
    </div>
  )
}
