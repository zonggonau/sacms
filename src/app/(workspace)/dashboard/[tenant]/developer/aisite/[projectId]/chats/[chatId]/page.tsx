import { redirect, notFound } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getTenantDb } from "@/lib/database"
import { getTenantAccess } from "@/lib/tenant-access"
import { loadMessages } from "@/lib/ai-site/chats"
import { ChatWorkspace } from "@/components/dashboard/ai-site/chat-workspace"

export default async function AiSiteChatPage({
  params,
}: {
  params: Promise<{ tenant: string; projectId: string; chatId: string }>
}) {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect("/login")

  const { tenant: tenantSlug, projectId, chatId } = await params
  const access = await getTenantAccess(session, tenantSlug)
  if (!access) redirect("/dashboard")

  const tenantDb = await getTenantDb(access.tenant.slug)
  const chat = await tenantDb.aiSiteChat.findFirst({
    where: { id: chatId, projectId, project: { tenantId: access.tenantId } },
  })
  if (!chat) notFound()

  const initialMessages = await loadMessages(tenantDb, chatId)

  return (
    <div className="h-full">
      <ChatWorkspace
        tenantSlug={access.tenant.slug}
        tenantId={tenantSlug}
        chat={{ id: chat.id, title: chat.title }}
        initialMessages={initialMessages}
        projectId={projectId}
      />
    </div>
  )
}
