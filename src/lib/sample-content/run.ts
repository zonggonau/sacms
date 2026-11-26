/**
 * Runs a SamplePlan through an injected writer, so the same loop serves the
 * workspace (createContentEntry, single-type upsert) and the Global demo
 * workspace (saveDemoContentEntry, updateDemoSingleTypeEntry). A ledger records
 * which ids each batch created, so a finished batch is never written twice and
 * a stopped one can be cleaned up.
 */
import { sampleEntryData } from "./values"
import type { SamplePlan, SampleSchema, PlanIssue, PlanStep } from "./plan"

export interface EntryWriter {
  /** Create one collection entry. */
  create(contentTypeSlug: string, data: Record<string, unknown>, locale: string): Promise<WriteResult>
  /** Write a Single Type's content for one locale. */
  upsertSingle(singleTypeSlug: string, data: Record<string, unknown>, locale: string): Promise<WriteResult>
  /** Ids of entries already in this workspace or demo for a Content Type, used as relation targets. */
  existingIds(contentTypeSlug: string, locale: string): Promise<string[]>
}

export type WriteResult = { ok: true; id: string } | { ok: false; message: string }

export interface SeedRecord {
  batchKey: string
  /** Locale the batch was written in. */
  locale?: string
  createdAt: string
  complete: boolean
  /**
   * Ids written by this batch. A Content Type's key is its slug; a Single
   * Type's key is `single:<slug>`, because its id is an assignment id.
   */
  ids: Record<string, string[]>
  error?: { contentType: string; message: string }
  cleared?: boolean
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

export const singleKey = (slug: string) => `single:${slug}`

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
    return { ...base, ok: true, alreadySeeded: true, created: 0, ids: previous.ids }
  }

  const ids: Record<string, string[]> = { ...(previous?.ids ?? {}) }
  const createdAt = previous?.createdAt ?? new Date().toISOString()
  let created = 0

  const existingCache = new Map<string, string[]>()
  const existingFor = async (slug: string): Promise<string[]> => {
    if (!existingCache.has(slug)) existingCache.set(slug, await writer.existingIds(slug, plan.locale))
    return existingCache.get(slug)!
  }
  // Written in this batch first, then whatever the workspace already had.
  const relationIdsFor = (target: string): string[] =>
    ids[target]?.length ? ids[target] : (existingCache.get(target) ?? [])

  const modelFor = (step: PlanStep) =>
    step.kind === "single"
      ? (schema.singleTypes ?? []).find((m) => m.slug === step.contentType)
      : schema.contentTypes.find((m) => m.slug === step.contentType)

  for (const step of plan.steps) {
    const model = modelFor(step)
    if (!model) continue
    const key = step.kind === "single" ? singleKey(step.contentType) : step.contentType

    for (const dep of step.dependsOn) {
      if (!ids[dep]?.length) await existingFor(dep)
    }
    for (const field of model.fields) {
      if (field.type === "relation" && field.relationSlug && !step.dependsOn.includes(field.relationSlug)) {
        await existingFor(field.relationSlug)
      }
    }

    const stepIds: string[] = []
    for (let index = 0; index < step.count; index++) {
      const data = sampleEntryData(model, step.fields, {
        index,
        contentTypeName: model.name,
        locale: plan.locale,
        relationIds: relationIdsFor,
        schema,
      })
      const result = step.kind === "single"
        ? await writer.upsertSingle(step.contentType, data, plan.locale)
        : await writer.create(step.contentType, data, plan.locale)
      if (!result.ok) {
        const error = { contentType: step.contentType, message: result.message }
        ids[key] = [...(ids[key] ?? []), ...stepIds]
        await ledger.save(ledgerKey, { batchKey: plan.batchKey, locale: plan.locale, createdAt, complete: false, ids, error })
        return { ...base, ok: false, alreadySeeded: false, created, ids, error }
      }
      stepIds.push(result.id)
      created++
    }
    ids[key] = [...(ids[key] ?? []), ...stepIds]
    await ledger.save(ledgerKey, { batchKey: plan.batchKey, locale: plan.locale, createdAt, complete: false, ids })
  }

  await ledger.save(ledgerKey, { batchKey: plan.batchKey, locale: plan.locale, createdAt, complete: true, ids })
  return { ...base, ok: true, alreadySeeded: false, created, ids }
}
