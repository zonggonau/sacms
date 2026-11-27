// SaCMS starter template: the zonggonau/sacms-nextjs-starter repository, downloaded from GitHub at
// the current commit of its default branch. An agent builds on it by adding files. Once a workspace
// or Website Template holds the starter, its own files are locked (see starterLockViolations): they
// may not be changed or removed, so the base stays the one SaCMS ships.
import { createHash } from "node:crypto"
import JSZip from "jszip"
import { db } from "@/lib/database"
import { safeFetch } from "@/lib/safe-url"
import { schemaTemplateBundleSchema } from "@/lib/validations/schema-template"

// Same digest as checksumOf in mcp-deployment-source.ts. Kept local so this module does not pull in
// that file's server-only import: the MCP route tests load it without that package.
const checksumOf = (content: string) => createHash("sha256").update(content).digest("hex")

export const STARTER_OWNER = "zonggonau"
export const STARTER_REPO_NAME = "sacms-nextjs-starter"
export const STARTER_REF = "master"
const STARTER_REPO = `${STARTER_OWNER}/${STARTER_REPO_NAME}`

const CACHE_TTL_MS = 10 * 60_000
const MAX_ARCHIVE_BYTES = 20 * 1024 * 1024
const BINARY_EXT_RE = /\.(png|jpe?g|gif|webp|avif|ico|woff2?|ttf|otf|eot|pdf|mp4|webm|zip|gz)$/i
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

const GITHUB_HEADERS = { Accept: "application/vnd.github+json", "User-Agent": "SaCMS-Starter-Sync" }

let cached: { snapshot: StarterSnapshot; at: number } | null = null

/** Fetches the starter at the current commit of STARTER_REF. Cached in-process for 10 minutes. */
export async function loadStarterSnapshot(): Promise<StarterSnapshot> {
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.snapshot
  const commit = await resolveStarterCommit()
  const files = await downloadStarterFiles(commit)
  const snapshot: StarterSnapshot = { repo: STARTER_REPO, commit, files, schema: starterSchemaFrom(files) }
  cached = { snapshot, at: Date.now() }
  return snapshot
}

/** Test hook: forget the cached snapshot. */
export function resetStarterCache(): void {
  cached = null
}

async function resolveStarterCommit(): Promise<string> {
  const res = await safeFetch(`https://api.github.com/repos/${STARTER_REPO}/commits/${STARTER_REF}`, { headers: GITHUB_HEADERS })
  if (!res.ok) throw new StarterUnavailableError(`GitHub menjawab ${res.status} untuk ${STARTER_REPO}@${STARTER_REF}.`)
  const body = (await res.json()) as { sha?: unknown }
  if (typeof body.sha !== "string" || !/^[0-9a-f]{40}$/.test(body.sha)) {
    throw new StarterUnavailableError("Respons GitHub tidak memuat commit starter yang valid.")
  }
  return body.sha
}

async function downloadStarterFiles(commit: string): Promise<StarterFile[]> {
  const res = await safeFetch(`https://codeload.github.com/${STARTER_REPO}/zip/${commit}`, { headers: { "User-Agent": GITHUB_HEADERS["User-Agent"] } })
  if (!res.ok) throw new StarterUnavailableError(`Gagal mengunduh arsip starter (${res.status}).`)
  const bytes = Buffer.from(await res.arrayBuffer())
  if (bytes.length > MAX_ARCHIVE_BYTES) throw new StarterUnavailableError("Arsip starter melebihi batas ukuran.")

  const zip = await JSZip.loadAsync(bytes)
  const entries = Object.values(zip.files)
  // GitHub wraps the repository in one folder named <repo>-<sha7>/; strip it so paths are repo-relative.
  const root = (entries[0]?.name ?? "").split("/")[0] + "/"
  if (root === "/") throw new StarterUnavailableError("Arsip starter kosong.")

  const files: StarterFile[] = []
  for (const entry of entries) {
    if (entry.dir) continue
    if (!entry.name.startsWith(root)) throw new StarterUnavailableError("Arsip starter memuat berkas di luar folder utamanya.")
    const path = entry.name.slice(root.length)
    if (!SAFE_PATH_RE.test(path) || EXCLUDED_FILES.has(path) || path.split("/").some((segment) => EXCLUDED_SEGMENTS.has(segment))) continue
    const binary = BINARY_EXT_RE.test(path)
    const content = await entry.async(binary ? "base64" : "string")
    files.push({ path, content, encoding: binary ? "base64" : "utf-8" })
  }
  if (files.length === 0) throw new StarterUnavailableError("Starter tidak memuat berkas yang bisa dipakai.")
  return files.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))
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
