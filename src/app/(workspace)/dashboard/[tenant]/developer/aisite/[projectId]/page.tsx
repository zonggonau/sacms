import { redirect, notFound } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getTenantDb } from "@/lib/database"
import { getTenantAccess } from "@/lib/tenant-access"

/**
 * A project has at most one chat (enforced in the API) — the chat IS the
 * website being developed. This route just resolves it and redirects.
 */
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
    include: { chats: { select: { id: true }, take: 1 } },
  })
  if (!project) notFound()

  if (project.chats[0]) {
    redirect(`/dashboard/${tenantSlug}/developer/aisite/${projectId}/chats/${project.chats[0].id}`)
  }
  redirect(`/dashboard/${tenantSlug}/developer/aisite`)
}
