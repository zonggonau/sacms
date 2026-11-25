import { db } from "@/lib/database"
import { describeSession, reportable } from "./mcp-preview"

export type WorkspacePreview = {
  label: string
  websiteTemplateId: string | null
  demoUrl: string | null
  session: ReturnType<typeof describeSession>
}

/** A workspace is a demo when a Schema Template uses it as its internal demo tenant. */
export async function isDemoWorkspace(tenantId: string): Promise<boolean> {
  return (await db.schemaTemplate.count({ where: { demoTenantId: tenantId } })) > 0
}

/**
 * Sandbox previews visible from a workspace's Hosting tab. A demo workspace shows
 * one entry per catalog Website Template built on it (global MCP sessions); a
 * client workspace shows its own site preview (workspace MCP session).
 */
export async function listWorkspacePreviews(tenantId: string, tenantSlug: string): Promise<{ isDemoWorkspace: boolean; previews: WorkspacePreview[] }> {
  const templates = await db.websiteTemplate.findMany({
    where: { deletedAt: null, schemaTemplate: { demoTenantId: tenantId } },
    select: { id: true, name: true, slug: true, demoUrl: true },
    orderBy: { createdAt: "asc" },
  })
  const isDemo = templates.length > 0 || (await isDemoWorkspace(tenantId))

  if (isDemo) {
    const sessions = await db.mcpPreviewSession.findMany({ where: { scope: "global", targetId: { in: templates.map((t) => t.id) } } })
    return {
      isDemoWorkspace: true,
      previews: templates.map((t) => {
        const s = sessions.find((x) => x.targetId === t.id)
        return { label: t.name, websiteTemplateId: t.id, demoUrl: t.demoUrl, session: describeSession("global", t.slug, s && reportable(s) ? s : null) }
      }),
    }
  }

  const s = await db.mcpPreviewSession.findUnique({ where: { scope_targetId: { scope: "workspace", targetId: tenantId } } })
  return {
    isDemoWorkspace: false,
    previews: [{ label: "Website workspace", websiteTemplateId: null, demoUrl: null, session: describeSession("workspace", tenantSlug, s && reportable(s) ? s : null) }],
  }
}
