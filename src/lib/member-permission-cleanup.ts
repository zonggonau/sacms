import type { getTenantDb } from "@/lib/database"
import { invalidatePermissionCache } from "@/lib/permissions-engine"

type TenantDb = Awaited<ReturnType<typeof getTenantDb>>

/**
 * Removes the Member role grants that point at Content Types being deleted.
 *
 * MemberRolePermission.contentTypeSlug is a plain string with no foreign key.
 * Without this, deleting a Content Type leaves its grants behind, and a new
 * Content Type later created with the same slug would inherit them silently.
 */
export async function removeMemberGrantsForContentTypes(
  tenantDb: TenantDb,
  tenantId: string,
  slugs: string[],
): Promise<number> {
  const unique = Array.from(new Set(slugs.filter(Boolean)))
  if (unique.length === 0) return 0

  const roles = await tenantDb.memberRole.findMany({ where: { tenantId }, select: { slug: true } })
  const result = await tenantDb.memberRolePermission.deleteMany({
    where: { contentTypeSlug: { in: unique }, memberRole: { tenantId } },
  })
  // The engine caches each role's grants for 60s; drop them now.
  await Promise.all(roles.map((r) => invalidatePermissionCache(tenantId, r.slug)))
  return result.count
}
