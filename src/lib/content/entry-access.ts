import type { PrismaClient } from "@/lib/database"

/**
 * Verify a content entry exists and belongs to this tenant (and, optionally, to
 * a given content-type slug). Returns the minimal entry row on success, `null`
 * otherwise — callers should 404.
 *
 * The version routes reach entries by id from the URL; on shared-pool tenants
 * `getTenantDb` is the master DB, so without this check a staff user of tenant A
 * could read or restore tenant B's content by guessing ids.
 */
export async function findEntryInTenant(
  client: PrismaClient,
  params: { entryId: string; tenantId: string | null; contentTypeSlug?: string },
): Promise<{ id: string; contentTypeId: string; tenantId: string | null } | null> {
  const entry = await client.contentEntry.findFirst({
    where: {
      id: params.entryId,
      tenantId: params.tenantId,
      ...(params.contentTypeSlug
        ? { contentType: { slug: params.contentTypeSlug } }
        : {}),
    },
    select: { id: true, contentTypeId: true, tenantId: true },
  })
  return entry
}
