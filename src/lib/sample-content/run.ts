/**
 * Runs a SamplePlan through an injected writer, so the same loop serves the
 * workspace (createContentEntry) and the Global demo workspace
 * (saveDemoContentEntry). A ledger records which ids each batch created, so a
 * finished batch is never written twice and a stopped one can be cleaned up.
 */
import { sampleEntryData } from "./values"
import type { SamplePlan, SampleSchema, PlanIssue } from "./plan"

export interface EntryWriter {
  create(contentTypeSlug: string, data: Record<string, unknown>, locale: string): Promise<{ ok: true; id: string } | { ok: false; message: string }>
  /** Ids of entries already in this workspace or demo for a Content Type, used as relation targets. */
  existingIds(contentTypeSlug: string, locale: string): Promise<string[]>
}

export interface SeedRecord {
  batchKey: string
  createdAt: string
  complete: boolean
  /** Content Type slug -> entry ids written by this batch. */
  ids: Record<string, string[]>
  error?: { contentType: string; message: string }
}

export interface SeedLedger {
  load(key: string): Promise<SeedRecord | null>
  save(key: string, record: SeedRecord): Promise<void>
}

export interface SeedResult {
  ok: boolean
  alreadySeeded: boolean
  batchKey: string
  created: number
  ids: Record<string, string[]>
  error?: { contentType: string; message: string }
  skipped: PlanIssue[]
  unfillable: PlanIssue[]
}

export async function runSamplePlan(input: {
  schema: SampleSchema
  plan: SamplePlan
  writer: EntryWriter
  ledger: SeedLedger
  /** Unique per workspace and batch, e.g. `sample-batch:<tenantId>:<batchKey>`. */
  ledgerKey: string
}): Promise<SeedResult> {
  const { schema, plan, writer, ledger, ledgerKey } = input
  const base = { batchKey: plan.batchKey, skipped: plan.skipped, unfillable: plan.unfillable }

  const previous = await ledger.load(ledgerKey)
  if (previous?.complete) {
    return {
      ...base,
      ok: true,
      alreadySeeded: true,
      created: 0,
      ids: previous.ids,
    }
  }

  const ids: Record<string, string[]> = { ...(previous?.ids ?? {}) }
  const createdAt = previous?.createdAt ?? new Date().toISOString()
  let created = 0

  const existingCache = new Map<string, string[]>()
  const existingFor = async (slug: string): Promise<string[]> => {
    if (!existingCache.has(slug)) existingCache.set(slug, await writer.existingIds(slug, plan.locale))
    return existingCache.get(slug)!
  }
  const relationIdsFor = (target: string): string[] => {
    // Written in this batch first, then whatever the workspace already had.
    return ids[target]?.length ? ids[target] : (existingCache.get(target) ?? [])
  }

  for (const step of plan.steps) {
    const ct = schema.contentTypes.find((c) => c.slug === step.contentType)
    if (!ct) continue

    // Make sure every relation target's existing ids are loaded before writing.
    for (const dep of step.dependsOn) {
      if (!ids[dep]?.length) await existingFor(dep)
    }
    for (const field of ct.fields) {
      if (field.type === "relation" && field.relationSlug && !step.dependsOn.includes(field.relationSlug)) {
        await existingFor(field.relationSlug)
      }
    }

    const stepIds: string[] = []
    for (let index = 0; index < step.count; index++) {
      const data = sampleEntryData(ct, step.fields, {
        index,
        contentTypeName: ct.name,
        locale: plan.locale,
        relationIds: relationIdsFor,
        schema,
      })
      const result = await writer.create(ct.slug, data, plan.locale)
      if (!result.ok) {
        const error = { contentType: ct.slug, message: result.message }
        ids[ct.slug] = [...(ids[ct.slug] ?? []), ...stepIds]
        await ledger.save(ledgerKey, { batchKey: plan.batchKey, createdAt, complete: false, ids, error })
        return { ...base, ok: false, alreadySeeded: false, created, ids, error, }
      }
      stepIds.push(result.id)
      created++
    }
    ids[ct.slug] = [...(ids[ct.slug] ?? []), ...stepIds]
    await ledger.save(ledgerKey, { batchKey: plan.batchKey, createdAt, complete: false, ids })
  }

  await ledger.save(ledgerKey, { batchKey: plan.batchKey, createdAt, complete: true, ids })
  return { ...base, ok: true, alreadySeeded: false, created, ids }
}
