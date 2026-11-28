// SaCMS starter template: the starter source is read from our own Vercel project (its production
// deployment), never from GitHub. An agent builds on it by adding files. Once a workspace or Website
// Template holds the starter, its own files are locked (see starterLockViolations): they may not be
// changed or removed, so the base stays the one SaCMS ships.
import { createHash } from "node:crypto"
import { db } from "@/lib/database"
import { getDeploymentFiles, getLatestDeployment } from "@/lib/vercel-client"
import { schemaTemplateBundleSchema } from "@/lib/validations/schema-template"

// Same digest as checksumOf in mcp-deployment-source.ts. Kept local so this module does not pull in
// that file's server-only import: the MCP route tests load it without that package.
const checksumOf = (content: string) => createHash("sha256").update(content).digest("hex")

const CACHE_TTL_MS = 10 * 60_000
const MAX_STARTER_FILES = 1000
const SAFE_PATH_RE = /^(?!\/)(?!.*\.\.(\/|$))[^\0\\]+$/
// Machine-local or generated files stay out of the snapshot. package-lock.json is left out as well:
// it is ~224 KB, over the 200 KB text cap of a Website Template, and npm regenerates it on install.
const EXCLUDED_FILES = new Set(["package-lock.json", "next-env.d.ts", "tsconfig.tsbuildinfo"])
const EXCLUDED_SEGMENTS = new Set(["node_modules", ".git", ".next"])

export class StarterUnavailableError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "StarterUnavailableError"
  }
}

export interface StarterFile {
  path: string
  content: string
  encoding: "utf-8" | "base64"
}

export type StarterSchemaBundle = ReturnType<typeof schemaTemplateBundleSchema.parse>

export interface StarterSnapshot {
  repo: string
  commit: string
  files: StarterFile[]
  schema: StarterSchemaBundle
}

/** Lock record stored in Setting: the starter's file hashes at download time. */
export interface StarterLock {
  repo: string
  commit: string
  files: Record<string, string>
}

let cached: { snapshot: StarterSnapshot; at: number } | null = null

/**
 * The starter as it is deployed to production on our Vercel project (SACMS_STARTER_VERCEL_PROJECT_ID).
 * Its files come straight from that deployment. Cached in-process for 10 minutes.
 */
export async function loadStarterSnapshot(): Promise<StarterSnapshot> {
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.snapshot
  const { deploymentId, files } = await fetchStarterFromVercel()
  const snapshot: StarterSnapshot = { repo: `vercel:${process.env.SACMS_STARTER_VERCEL_PROJECT_ID}`, commit: deploymentId, files, schema: starterSchemaFrom(files) }
  cached = { snapshot, at: Date.now() }
  return snapshot
}

/** Test hook: forget the cached snapshot. */
export function resetStarterCache(): void {
  cached = null
}

async function fetchStarterFromVercel(): Promise<{ deploymentId: string; files: StarterFile[] }> {
  const projectId = process.env.SACMS_STARTER_VERCEL_PROJECT_ID
  if (!projectId) throw new StarterUnavailableError("Starter belum dikonfigurasi: SACMS_STARTER_VERCEL_PROJECT_ID belum diatur.")
  const latest = await getLatestDeployment(projectId)
  if (!latest) throw new StarterUnavailableError("Project starter di Vercel belum punya deployment production.")

  const { files: deployed, truncated } = await getDeploymentFiles(latest.id, MAX_STARTER_FILES)
  if (truncated) throw new StarterUnavailableError("Deployment starter melebihi batas jumlah file.")
  const files: StarterFile[] = []
  for (const file of deployed) {
    const path = file.name
    if (!SAFE_PATH_RE.test(path) || EXCLUDED_FILES.has(path) || path.split("/").some((segment) => EXCLUDED_SEGMENTS.has(segment))) continue
    files.push({ path, content: file.content, encoding: file.encoding })
  }
  if (files.length === 0) throw new StarterUnavailableError("Deployment starter tidak memuat berkas yang bisa dipakai.")
  return { deploymentId: latest.id, files: files.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0)) }
}

/** The starter's `sacms/schema.json` (components + singles) in the Schema Template bundle shape. */
function starterSchemaFrom(files: StarterFile[]): StarterSchemaBundle {
  const file = files.find((f) => f.path === "sacms/schema.json")
  if (!file) throw new StarterUnavailableError("Starter tidak memuat sacms/schema.json.")
  let raw: { components?: unknown; singles?: unknown }
  try {
    raw = JSON.parse(file.content)
  } catch {
    throw new StarterUnavailableError("sacms/schema.json bukan JSON yang valid.")
  }
  const parsed = schemaTemplateBundleSchema.safeParse({ contentTypes: [], singleTypes: raw.singles ?? [], components: raw.components ?? [] })
  if (!parsed.success) throw new StarterUnavailableError(`sacms/schema.json tidak sesuai bundle schema: ${parsed.error.issues[0]?.message ?? "tidak valid"}`)
  return parsed.data
}

export function starterLockFor(snapshot: StarterSnapshot): StarterLock {
  return {
    repo: snapshot.repo,
    commit: snapshot.commit,
    files: Object.fromEntries(snapshot.files.map((f) => [f.path, checksumOf(f.content)])),
  }
}

/** Setting key of a workspace's starter lock. */
export const workspaceLockKey = (tenantId: string) => `starter-lock:workspace:${tenantId}`
/** Setting key of a Website Template's starter lock. */
export const templateLockKey = (templateId: string) => `starter-lock:template:${templateId}`

export async function readStarterLock(key: string): Promise<StarterLock | null> {
  const row = await db.setting.findUnique({ where: { key }, select: { value: true } })
  if (!row) return null
  try {
    return JSON.parse(row.value) as StarterLock
  } catch {
    return null
  }
}

/** Reasons the given files break the lock: a locked file changed or disappeared. New files are always allowed. */
export function starterLockViolations(lock: StarterLock, files: { path: string; content: string }[]): string[] {
  const byPath = new Map(files.map((f) => [f.path, f.content]))
  const violations: string[] = []
  for (const [path, hash] of Object.entries(lock.files)) {
    const content = byPath.get(path)
    if (content === undefined) violations.push(`dihapus: ${path}`)
    else if (checksumOf(content) !== hash) violations.push(`diubah: ${path}`)
  }
  return violations
}

function breachMessage(violations: string[]): string | null {
  if (violations.length === 0) return null
  const shown = violations.slice(0, 10).join(", ")
  const more = violations.length > 10 ? ` (+${violations.length - 10} lainnya)` : ""
  return `Starter template terkunci: file dari starter tidak boleh diubah atau dihapus. Tambahkan file baru untuk fitur Anda. ${shown}${more}`
}

/** Message for a failed lock check over a complete file set, or null when it respects the lock (or no lock exists). */
export async function starterLockBreach(key: string, files: { path: string; content: string }[]): Promise<string | null> {
  const lock = await readStarterLock(key)
  if (!lock) return null
  return breachMessage(starterLockViolations(lock, files))
}

/**
 * The same check for a partial write (apply_preview_changes): only the files it carries are judged. A
 * locked path that is carried with its starter content passes; one carried with different content fails.
 */
export async function starterChangeBreach(key: string, changed: { path: string; content: string }[]): Promise<string | null> {
  const lock = await readStarterLock(key)
  if (!lock) return null
  return breachMessage(
    changed
      .filter((f) => lock.files[f.path] !== undefined && checksumOf(f.content) !== lock.files[f.path])
      .map((f) => `diubah: ${f.path}`),
  )
}

export async function writeStarterLock(
  tx: Pick<typeof db, "setting">,
  key: string,
  tenantId: string | null,
  lock: StarterLock,
): Promise<void> {
  const value = JSON.stringify(lock)
  await tx.setting.upsert({ where: { key }, update: { value, tenantId }, create: { key, value, tenantId }, select: { key: true } })
}
