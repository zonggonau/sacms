/**
 * Pure helpers for reading, verifying, and clearing sample batches. The MCP
 * tools supply the database adapters, so this module needs no database.
 */
import type { SeedRecord } from "./run"

export const BATCH_PREFIX_SEP = ":"

/** Ledger key for a batch: `sample-batch:<scopeId>:<batchKey>`. */
export function ledgerKeyFor(scopeId: string, batchKey: string): string {
  return ["sample-batch", scopeId, batchKey].join(BATCH_PREFIX_SEP)
}

/** Ledger key prefix for every batch in one scope. */
export function ledgerPrefixFor(scopeId: string): string {
  return ["sample-batch", scopeId, ""].join(BATCH_PREFIX_SEP)
}

/** Batch key from a ledger key, or null when the key is not a sample batch. */
export function batchKeyFromLedgerKey(key: string): string | null {
  // Keys are sample-batch:<scope>:<batchKey>, and a demo scope adds its own
  // colon-separated part. The batch key is always the last segment.
  if (!key.startsWith("sample-batch" + BATCH_PREFIX_SEP)) return null
  const last = key.slice(key.lastIndexOf(BATCH_PREFIX_SEP) + 1)
  return last.length > 0 ? last : null
}

export function parseRecord(raw: string): SeedRecord | null {
  try {
    const value = JSON.parse(raw) as SeedRecord
    return value && typeof value === "object" && value.ids ? value : null
  } catch {
    return null
  }
}

export interface BatchSummary {
  batchId: string
  locale: string | null
  createdAt: string | null
  complete: boolean
  cleared: boolean
  collections: Record<string, number>
  singles: string[]
}

export function summarizeBatch(batchId: string, record: SeedRecord): BatchSummary {
  const collections: Record<string, number> = {}
  const singles: string[] = []
  for (const [key, ids] of Object.entries(record.ids)) {
    if (key.startsWith("single:")) singles.push(key.slice("single:".length))
    else collections[key] = ids.length
  }
  return {
    batchId,
    locale: record.locale ?? null,
    createdAt: record.createdAt ?? null,
    complete: record.complete,
    cleared: record.cleared === true,
    collections,
    singles,
  }
}

export interface ClearTargets {
  collections: Array<{ contentType: string; ids: string[] }>
  singles: Array<{ singleType: string; slug: string }>
}

/** What clearing a batch must remove. Only what the ledger recorded is listed. */
export function clearTargets(record: SeedRecord): ClearTargets {
  const collections: ClearTargets["collections"] = []
  const singles: ClearTargets["singles"] = []
  for (const [key, ids] of Object.entries(record.ids)) {
    if (key.startsWith("single:")) {
      const slug = key.slice("single:".length)
      singles.push({ singleType: slug, slug })
    } else if (ids.length > 0) {
      collections.push({ contentType: key, ids })
    }
  }
  return { collections, singles }
}

export interface VerifyAdapters {
  /** The entry as stored, or null when it does not exist or was deleted. */
  entry(contentType: string, id: string): Promise<{ status: string; locale: string } | null>
  /** Ids the public content API returns for this Content Type and locale (PUBLISHED only). */
  publicIds(contentType: string, locale: string): Promise<Set<string>>
  /** Whether the Single Type's content for this locale is published, or null when absent. */
  single(slug: string, locale: string): Promise<{ published: boolean } | null>
}

export interface VerifyCheck {
  kind: "collection" | "single"
  target: string
  id?: string
  ok: boolean
  detail: string
}

export interface VerifyReport {
  ok: boolean
  locale: string
  checks: VerifyCheck[]
  /** Entries that exist but are not public yet (DRAFT, IN_REVIEW, ...). Not a failure. */
  notPublic: number
}

/**
 * Reads every recorded entry back and checks it is in the batch's locale.
 * Anything PUBLISHED must also appear in the public content API, which is what
 * the website reads. Drafts are reported as not public, not as failures.
 */
export async function verifyBatch(record: SeedRecord, adapters: VerifyAdapters): Promise<VerifyReport> {
  const locale = record.locale ?? "id"
  const checks: VerifyCheck[] = []
  let notPublic = 0

  for (const [key, ids] of Object.entries(record.ids)) {
    if (key.startsWith("single:")) {
      const slug = key.slice("single:".length)
      const single = await adapters.single(slug, locale)
      checks.push({
        kind: "single",
        target: slug,
        ok: single !== null,
        detail: single === null ? "content for this locale is missing" : single.published ? "published and readable" : "saved as draft, not public",
      })
      if (single && !single.published) notPublic++
      continue
    }

    const publicIds = await adapters.publicIds(key, locale)
    for (const id of ids) {
      const entry = await adapters.entry(key, id)
      if (!entry) {
        checks.push({ kind: "collection", target: key, id, ok: false, detail: "entry is missing or deleted" })
        continue
      }
      if (entry.locale !== locale) {
        checks.push({ kind: "collection", target: key, id, ok: false, detail: `locale is ${entry.locale}, expected ${locale}` })
        continue
      }
      if (entry.status === "PUBLISHED") {
        const visible = publicIds.has(id)
        checks.push({
          kind: "collection",
          target: key,
          id,
          ok: visible,
          detail: visible ? "published and returned by the public API" : "PUBLISHED in the database but missing from the public API",
        })
      } else {
        notPublic++
        checks.push({ kind: "collection", target: key, id, ok: true, detail: `saved as ${entry.status}, not public` })
      }
    }
  }

  return { ok: checks.every((c) => c.ok), locale, checks, notPublic }
}

