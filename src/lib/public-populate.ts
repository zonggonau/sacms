import { getTenantDb } from "@/lib/database"
import { authorizeActor, type PublicApiActor } from "@/lib/public-api-actor"

/**
 * Relation expansion for the public content API (`?populate=`).
 *
 * A populated relation is only ever read when the caller may read its target:
 * - a relation to a Content Type needs `find` on that Content Type for this caller;
 * - a relation to Members returns only { id, name, avatar } to public and member
 *   callers. API tokens get the full Member record (without credentials).
 *
 * A relation the caller may not expand is left as its raw id, the same as an
 * unpopulated relation, so the caller learns nothing about the target.
 */

export interface PopulateField {
  slug: string
  relationSlug?: string | null
  options?: unknown
}

type TenantDb = Awaited<ReturnType<typeof getTenantDb>>

export type PopulateTarget = { kind: "member" } | { kind: "entry"; slug: string }

export function populateTargetOf(field: PopulateField): PopulateTarget | null {
  const opts = (field.options ?? {}) as { targetModel?: string }
  if (opts.targetModel === "member") return { kind: "member" }
  if (field.relationSlug) return { kind: "entry", slug: field.relationSlug }
  return null
}

const MEMBER_PUBLIC_SELECT = { id: true, name: true, avatar: true } as const
const MEMBER_FULL_SELECT = { id: true, name: true, email: true, avatar: true, role: true, status: true, createdAt: true } as const

export interface ResolvedPopulate {
  /** Field slugs whose relation was expanded for this caller. */
  expanded: Set<string>
  /** Related record by id, shaped for the response. */
  byId: Map<string, Record<string, unknown>>
}

export async function resolvePopulate(args: {
  tenantDb: TenantDb
  tenantId: string
  actor: PublicApiActor
  fields: PopulateField[]
  rows: Record<string, unknown>[]
  publishedOnly: boolean
}): Promise<ResolvedPopulate> {
  const { tenantDb, tenantId, actor, fields, rows, publishedOnly } = args
  const expanded = new Set<string>()
  const byId = new Map<string, Record<string, unknown>>()

  // Decide per field, once per distinct target.
  const readable = new Map<string, boolean>()
  const idsByTarget = new Map<string, { target: PopulateTarget; ids: Set<string> }>()

  for (const field of fields) {
    const target = populateTargetOf(field)
    if (!target) continue
    const key = target.kind === "member" ? "member" : `entry:${target.slug}`
    if (target.kind === "entry" && !readable.has(key)) {
      readable.set(key, (await authorizeActor(actor, target.slug, "find")) === null)
    }
    if (target.kind === "entry" && !readable.get(key)) continue

    const ids = new Set<string>()
    for (const row of rows) {
      const val = row[field.slug]
      if (typeof val === "string" && val.length > 10) ids.add(val)
      else if (Array.isArray(val)) val.forEach((id) => { if (typeof id === "string") ids.add(id) })
    }
    if (!idsByTarget.has(key)) idsByTarget.set(key, { target, ids: new Set() })
    ids.forEach((id) => idsByTarget.get(key)!.ids.add(id))
    expanded.add(field.slug)
  }

  for (const { target, ids } of idsByTarget.values()) {
    if (ids.size === 0) continue
    const idList = Array.from(ids)
    if (target.kind === "entry") {
      // Filtered by Content Type, so an id of another type is never read through this relation.
      const entries = await tenantDb.contentEntry.findMany({
        where: {
          id: { in: idList },
          tenantId,
          deletedAt: null,
          contentType: { slug: target.slug },
          ...(publishedOnly ? { status: "PUBLISHED" as const } : {}),
        },
        select: { id: true, data: true, locale: true, status: true },
      })
      for (const re of entries) {
        let rd: Record<string, unknown> = {}
        try {
          rd = typeof re.data === "string" ? JSON.parse(re.data as string) : ((re.data as Record<string, unknown>) || {})
        } catch { rd = {} }
        byId.set(re.id, { id: re.id, ...rd, locale: re.locale, status: re.status })
      }
    } else {
      const members = await tenantDb.member.findMany({
        where: { id: { in: idList }, tenantId },
        select: actor.kind === "api-token" ? MEMBER_FULL_SELECT : MEMBER_PUBLIC_SELECT,
      })
      for (const m of members) byId.set(m.id, m as Record<string, unknown>)
    }
  }

  // A relation id that was not fetched (unpublished, deleted, wrong type) stays a raw id in the caller.
  return { expanded, byId }
}

/** Replace raw relation ids in one row with their expanded records. */
export function applyPopulate(
  row: Record<string, unknown>,
  fieldSlugs: Iterable<string>,
  byId: Map<string, Record<string, unknown>>,
): Record<string, unknown> {
  const out = { ...row }
  for (const slug of fieldSlugs) {
    const val = row[slug]
    if (typeof val === "string") out[slug] = byId.get(val) ?? val
    else if (Array.isArray(val)) out[slug] = val.map((id) => (typeof id === "string" ? byId.get(id) ?? id : id))
  }
  return out
}
