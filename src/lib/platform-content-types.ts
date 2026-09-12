/**
 * Platform-internal content types — SaCMS's own billing/pricing data
 * (account plans, workspace plans, AI credit packs, add-ons), seeded as
 * global content types (`tenantId: null`) so the platform's own pricing
 * pages can read them the same way tenant content is read.
 *
 * They are NOT shared templates a tenant can build on. Any tenant-facing
 * listing of "content types available to me" (the CMS sidebar, the
 * Roles & Permissions matrix, the OpenAPI/dev-tools generators, etc.)
 * must exclude these — a tenant's own end-users have no reason to ever
 * see "SaCMS Account Plans" as something they could grant a permission on.
 *
 * Identified by slug prefix rather than a schema flag: all four were
 * deliberately named with this prefix specifically to be internal-only.
 */
const PLATFORM_CONTENT_TYPE_PREFIX = "sacms-"

/**
 * `posts` (scripts/seed-all-global.ts) is a global content type — SaCMS's
 * own marketing blog at /blog — seeded before the `sacms-` prefix
 * convention was adopted for every other global type. Renaming its slug
 * now would break the live blog and any code that already reads it by
 * that exact slug, so it's excluded here by name instead. Any *new* global
 * content type should just use the `sacms-` prefix like the rest already
 * do — this list should never need to grow.
 */
const LEGACY_UNPREFIXED_PLATFORM_SLUGS = new Set(["posts"])

export function isPlatformContentTypeSlug(slug: string): boolean {
  return slug.startsWith(PLATFORM_CONTENT_TYPE_PREFIX) || LEGACY_UNPREFIXED_PLATFORM_SLUGS.has(slug)
}

/** Prisma filter fragment excluding every platform-internal content type
 *  (the `sacms-` prefixed ones, plus the pre-convention `posts` type).
 *  Untyped/mutable on purpose — `as const` makes its arrays readonly,
 *  which Prisma's generated `ContentTypeWhereInput` (mutable arrays)
 *  rejects wherever this gets spread into another `where` object. */
export const EXCLUDE_PLATFORM_CONTENT_TYPES: {
  NOT: {
    OR: ({ slug: { startsWith: string } } | { slug: { in: string[] } })[]
  }
} = {
  NOT: {
    OR: [
      { slug: { startsWith: PLATFORM_CONTENT_TYPE_PREFIX } },
      { slug: { in: Array.from(LEGACY_UNPREFIXED_PLATFORM_SLUGS) } },
    ],
  },
}
