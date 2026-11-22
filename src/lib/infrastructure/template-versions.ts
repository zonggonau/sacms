import { createHash } from "crypto"
import { db } from "@/lib/database"

export interface VersionFile {
  path: string
  content: string
  encoding?: "utf-8" | "base64"
}

/** Older versions beyond this are pruned — enough to recover from a bad
 *  edit without letting every ~200KB bundle accumulate forever. */
export const MAX_VERSIONS_PER_TEMPLATE = 30

/** sha256 of the file's real bytes — a base64 asset is decoded first, so the
 *  hash matches `sha256sum` of the file on disk. Text hashes are unchanged. */
export function fileSha256(content: string, encoding?: "utf-8" | "base64"): string {
  return createHash("sha256").update(encoding === "base64" ? Buffer.from(content, "base64") : content).digest("hex")
}

export function summarizeFileChanges(previous: VersionFile[], next: VersionFile[]) {
  const before = new Map(previous.map((f) => [f.path, fileSha256(f.content, f.encoding)]))
  const after = new Map(next.map((f) => [f.path, fileSha256(f.content, f.encoding)]))
  let added = 0
  let changed = 0
  let removed = 0
  for (const [path, hash] of after) {
    const prior = before.get(path)
    if (prior === undefined) added++
    else if (prior !== hash) changed++
  }
  for (const path of before.keys()) if (!after.has(path)) removed++
  return { added, changed, removed }
}

function isUniqueViolation(err: unknown) {
  return (err as { code?: string })?.code === "P2002"
}

async function insertVersion(input: {
  websiteTemplateId: string
  files: VersionFile[]
  schema: unknown
  summary: string
  changedBy: string | null
  tokenId: string | null
}) {
  // Retried once on a version-number race between two concurrent writes.
  for (let attempt = 0; attempt < 2; attempt++) {
    const latest = await db.websiteTemplateVersion.findFirst({
      where: { websiteTemplateId: input.websiteTemplateId },
      orderBy: { version: "desc" },
      select: { version: true },
    })
    const version = (latest?.version ?? 0) + 1
    try {
      const created = await db.websiteTemplateVersion.create({
        data: {
          websiteTemplateId: input.websiteTemplateId,
          version,
          files: input.files as object,
          schema: (input.schema ?? null) as object,
          summary: input.summary,
          changedBy: input.changedBy,
          tokenId: input.tokenId,
        },
      })
      await db.websiteTemplateVersion.deleteMany({
        where: { websiteTemplateId: input.websiteTemplateId, version: { lte: version - MAX_VERSIONS_PER_TEMPLATE } },
      })
      return created
    } catch (err) {
      if (!isUniqueViolation(err) || attempt === 1) throw err
    }
  }
  return null
}

/**
 * Records the template's state after a source change. Best-effort by
 * design — called AFTER the real write has committed, and a failure here
 * is logged, never surfaced: losing one history entry must not fail (or
 * roll back) the edit itself.
 *
 * `baseline` is the state BEFORE this change: a template edited for the
 * first time since history tracking existed has no versions yet, so its
 * pre-edit state is recorded first — otherwise that very first change
 * could never be rolled back.
 */
export async function recordTemplateVersion(input: {
  websiteTemplateId: string
  files: VersionFile[]
  schema: unknown
  changedBy: string | null
  tokenId: string | null
  schemaChanged?: boolean
  note?: string
  baseline?: { files: VersionFile[]; schema: unknown }
}) {
  try {
    const existingCount = await db.websiteTemplateVersion.count({ where: { websiteTemplateId: input.websiteTemplateId } })
    if (existingCount === 0 && input.baseline) {
      await insertVersion({
        websiteTemplateId: input.websiteTemplateId,
        files: input.baseline.files,
        schema: input.baseline.schema,
        summary: `Baseline before the first tracked change (${input.baseline.files.length} files)`,
        changedBy: null,
        tokenId: null,
      })
    }

    const previous = existingCount === 0 && !input.baseline
      ? null
      : await db.websiteTemplateVersion.findFirst({
          where: { websiteTemplateId: input.websiteTemplateId },
          orderBy: { version: "desc" },
          select: { files: true },
        })

    let summary: string
    if (!previous) {
      summary = `Created (${input.files.length} files)`
    } else {
      const { added, changed, removed } = summarizeFileChanges(previous.files as unknown as VersionFile[], input.files)
      summary = `+${added} ~${changed} -${removed} files${input.schemaChanged ? "; schema changed" : ""}`
    }
    if (input.note) summary = `${input.note}: ${summary}`

    return await insertVersion({ ...input, summary })
  } catch (err) {
    console.warn(`[template-versions] Failed to record a version for ${input.websiteTemplateId}:`, err)
    return null
  }
}
