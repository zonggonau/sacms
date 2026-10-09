import { db } from "./database"
import { getRedis } from "./redis"

/** Keep at most this many previous versions per site — oldest are pruned. */
export const STATIC_SITE_VERSION_LIMIT = 10

function staticSiteFlagKey(tenantSlug: string) {
  return `static-site:${tenantSlug}`
}

/**
 * Sets/clears the Redis flag src/proxy.ts checks to decide whether a
 * subdomain's root path should serve the static site instead of the CMS
 * Studio. Best-effort — if Redis is unavailable, proxy.ts just falls back
 * to the CMS Studio default, so a failure here is never fatal.
 */
export async function setStaticSiteFlag(tenantSlug: string, published: boolean) {
  const redis = getRedis()
  if (!redis) return
  try {
    if (published) await redis.set(staticSiteFlagKey(tenantSlug), "1")
    else await redis.del(staticSiteFlagKey(tenantSlug))
  } catch {
    // See docstring — best-effort cache, never the source of truth.
  }
}

/**
 * Snapshots a site's current live html/js into its version history before
 * it gets overwritten (by publish or rollback), then trims history back to
 * STATIC_SITE_VERSION_LIMIT. Call this with the OUTGOING content, before
 * writing the new content to the live fields.
 */
export async function snapshotCurrentVersion(siteId: string, html: string, js: string, prompt: string | null) {
  await db.tenantStaticSiteVersion.create({
    data: { siteId, html, js, prompt },
  })

  const excess = await db.tenantStaticSiteVersion.findMany({
    where: { siteId },
    orderBy: { publishedAt: "desc" },
    skip: STATIC_SITE_VERSION_LIMIT,
    select: { id: true },
  })
  if (excess.length > 0) {
    await db.tenantStaticSiteVersion.deleteMany({ where: { id: { in: excess.map((v) => v.id) } } })
  }
}
