import { resolveApiOrigin } from "@/lib/infrastructure/frontend-env"

/**
 * Every media upload whose workspace has no custom public storage URL
 * configured (the common case — see buildUrl in r2.ts) stores this private,
 * session-gated proxy path as its `url`/`thumbnailUrl`/`mediumUrl`. Fine for
 * the CMS dashboard (already authenticated), but a real visitor's browser
 * has no session to present — confirmed live: a published product's photo
 * came back empty because the public content API returned this URL
 * verbatim and it 401s with no login.
 */
const PRIVATE_MEDIA_PROXY_PREFIX = "/api/media/serve?key="

function rewriteValue(value: string): string {
  if (!value.startsWith(PRIVATE_MEDIA_PROXY_PREFIX)) return value
  const key = value.slice(PRIVATE_MEDIA_PROXY_PREFIX.length)
  return `${resolveApiOrigin()}/api/public/media?key=${key}`
}

/**
 * Deep-walks a PUBLISHED entry/assignment's field data and rewrites any
 * embedded private media proxy URL to the public, unauthenticated
 * equivalent (/api/public/media) — recurses into components/repeaters and
 * relation objects, since a media field can be nested arbitrarily deep.
 *
 * Callers must only apply this to data that has ALREADY been confirmed
 * published — it carries no publish check of its own, by design (see
 * src/app/api/public/media/route.ts's own doc comment for why that's safe).
 */
export function rewritePublicMediaUrls<T>(value: T): T {
  if (typeof value === "string") return rewriteValue(value) as unknown as T
  if (Array.isArray(value)) return value.map((v) => rewritePublicMediaUrls(v)) as unknown as T
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = rewritePublicMediaUrls(v)
    }
    return out as unknown as T
  }
  return value
}
