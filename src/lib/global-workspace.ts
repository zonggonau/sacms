import { getGlobalWorkspaceId } from "@/lib/settings"

/**
 * True when this workspace is the SaCMS Global one (the globalTenantId
 * setting, matched by id or slug). Global's own schema is shared platform
 * structure, so destructive schema actions are blocked for it.
 */
export async function isGlobalWorkspace(tenant: { id: string; slug: string }): Promise<boolean> {
  const globalId = await getGlobalWorkspaceId()
  return tenant.id === globalId || tenant.slug === globalId
}
