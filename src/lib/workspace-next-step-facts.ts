import { getTenantDb } from "@/lib/database"
import type { WorkspaceFacts } from "@/lib/workspace-next-step"

// Reads the counts deriveNextStep needs. Draft rows (draftTemplateId set) belong
// to a Schema Template's own workspace and are not this workspace's schema, so
// they are left out.
export async function loadWorkspaceFacts(tenantId: string, tenantSlug: string): Promise<WorkspaceFacts> {
  const tenantDb = await getTenantDb(tenantSlug)
  const live = { tenantId, draftTemplateId: null }
  const [contentTypeCount, singleTypeCount, componentCount, entryCount, tenant] = await Promise.all([
    tenantDb.contentType.count({ where: live }).catch(() => 0),
    tenantDb.singleType.count({ where: live }).catch(() => 0),
    tenantDb.component.count({ where: live }).catch(() => 0),
    tenantDb.contentEntry.count({ where: { tenantId, deletedAt: null } }).catch(() => 0),
    tenantDb.tenant.findUnique({
      where: { id: tenantId },
      select: { vercelProjectId: true, vercelDeploymentUrl: true },
    }).catch(() => null),
  ])
  return {
    contentTypeCount,
    singleTypeCount,
    componentCount,
    entryCount,
    hasSite: Boolean(tenant?.vercelProjectId || tenant?.vercelDeploymentUrl),
  }
}
