import { redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getTenantDb } from "@/lib/database"
import { getTenantAccess } from "@/lib/tenant-access"
import { isSchemaFinalized } from "@/lib/schema-lock"
import { buildAiSitePromptFromSchema } from "@/lib/ai-site/schema-prompt"
import { AiSiteLanding } from "@/components/dashboard/ai-site/ai-site-landing"
import { SchemaNotFinalizedNotice } from "@/components/dashboard/ai-site/schema-not-finalized-notice"

/**
 * One AI Site project per workspace — it's the single website being
 * developed, not one of many. If it (and its one chat) already exist,
 * skip straight to the chat workspace; otherwise show the v0-style prompt
 * landing to start building.
 */
export default async function AiSiteHomePage({ params }: { params: Promise<{ tenant: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect("/login")

  const { tenant: tenantSlug } = await params
  const access = await getTenantAccess(session, tenantSlug)
  if (!access) redirect("/dashboard")

  const tenantDb = await getTenantDb(access.tenant.slug)
  const project = await tenantDb.aiSiteProject.findFirst({
    where: { tenantId: access.tenantId },
    include: { chats: { select: { id: true }, take: 1 } },
  })

  if (project?.chats[0]) {
    redirect(`/dashboard/${tenantSlug}/developer/aisite/${project.id}/chats/${project.chats[0].id}`)
  }

  // No project yet — AI Site must not let a tenant start building a
  // frontend against a schema that's still subject to change underneath
  // it. Finalize the schema at /developer/schema first.
  if (!(await isSchemaFinalized(access.tenantId))) {
    return <SchemaNotFinalizedNotice tenantId={tenantSlug} />
  }

  // Schema's already finalized — the user just designed this structure, so
  // don't make them re-describe it in prose. Pre-fill the prompt from it;
  // they can still edit before generating.
  const suggestedPrompt = await buildAiSitePromptFromSchema(tenantDb, access.tenantId)

  return (
    <AiSiteLanding
      tenantSlug={access.tenant.slug}
      tenantId={tenantSlug}
      existingProjectId={project?.id ?? null}
      initialPrompt={suggestedPrompt}
    />
  )
}
