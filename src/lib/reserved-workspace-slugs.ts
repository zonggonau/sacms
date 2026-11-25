import { getGlobalWorkspaceId } from "@/lib/settings"

const RESERVED_SLUGS = ["sacms-global", "sacms", "system"]

/**
 * A workspace whose id or slug equals the globalTenantId setting is treated
 * as SaCMS Global (see tenant-access.ts) and gets platform-wide powers over
 * the template catalog and shared content. These slugs must never be handed
 * to a newly created workspace, or anyone could become Global by name.
 */
export async function isReservedWorkspaceSlug(slug: string): Promise<boolean> {
  const value = slug.trim().toLowerCase()
  if (RESERVED_SLUGS.includes(value)) return true
  const globalId = await getGlobalWorkspaceId().catch(() => "sacms-global")
  return value === globalId.trim().toLowerCase()
}
