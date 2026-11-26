/**
 * Clears one recorded sample batch. Only the ids the ledger recorded are
 * touched. Collection entries are soft-deleted through the caller's delete
 * (the same path as the dashboard trash, so they can be restored within the
 * trash window). Single Type content for the batch's locale is emptied. The
 * batch is then marked cleared, so a second call does nothing.
 */
import { clearTargets, type ClearTargets } from "./batch-ops"
import type { SeedRecord } from "./run"

export interface ClearDeps {
  /** "deleted" when removed now, "gone" when it was already deleted. Throws on a real failure. */
  deleteEntry(contentType: string, id: string): Promise<"deleted" | "gone">
  clearSingle(singleType: string, locale: string): Promise<boolean>
  saveRecord(record: SeedRecord): Promise<void>
}

export interface ClearResult {
  alreadyCleared: boolean
  deletedEntries: number
  clearedSingles: number
  failures: Array<{ target: string; id?: string; message: string }>
  targets: ClearTargets
}

export async function clearSampleBatch(record: SeedRecord, deps: ClearDeps): Promise<ClearResult> {
  const targets = clearTargets(record)
  if (record.cleared) {
    return { alreadyCleared: true, deletedEntries: 0, clearedSingles: 0, failures: [], targets }
  }

  const locale = record.locale ?? "id"
  const failures: ClearResult["failures"] = []
  let deletedEntries = 0
  let clearedSingles = 0

  for (const group of targets.collections) {
    for (const id of group.ids) {
      try {
        if ((await deps.deleteEntry(group.contentType, id)) === "deleted") deletedEntries++
      } catch (error) {
        failures.push({ target: group.contentType, id, message: error instanceof Error ? error.message : "delete failed" })
      }
    }
  }
  for (const single of targets.singles) {
    try {
      if (await deps.clearSingle(single.singleType, locale)) clearedSingles++
    } catch (error) {
      failures.push({ target: single.singleType, message: error instanceof Error ? error.message : "clear failed" })
    }
  }

  // Only mark the batch cleared when nothing failed. A failed batch stays
  // listed so the failed ids can be retried.
  if (failures.length === 0) {
    await deps.saveRecord({ ...record, cleared: true })
  }
  return { alreadyCleared: false, deletedEntries, clearedSingles, failures, targets }
}
