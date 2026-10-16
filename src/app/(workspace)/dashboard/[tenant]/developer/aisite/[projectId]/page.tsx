import { redirect, notFound } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getTenantDb } from "@/lib/database"
import { getTenantAccess } from "@/lib/tenant-access"
import { listChats } from "@/lib/ai-site/chats"
import { ProjectChatsClient } from "@/components/dashboard/ai-site/project-chats-client"

export default async function AiSiteProjectPage({
  params,
}: {
  params: Promise<{ tenant: string; projectId: string }>
}) {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect("/login")

  const { tenant: tenantSlug, projectId } = await params
  const access = await getTenantAccess(session, tenantSlug)
  if (!access) redirect("/dashboard")

  const tenantDb = await getTenantDb(access.tenant.slug)
  const project = await tenantDb.aiSiteProject.findFirst({
    where: { id: projectId, tenantId: access.tenantId },
  })
  if (!project) notFound()

  const chats = await listChats(tenantDb, projectId)

  return (
    <div className="p-4 md:p-6 lg:p-8 w-full max-w-5xl mx-auto">
      <ProjectChatsClient
        tenantSlug={access.tenant.slug}
        tenantId={tenantSlug}
        projectId={projectId}
        projectName={project.name}
        initialChats={chats}
      />
    </div>
  )
}
