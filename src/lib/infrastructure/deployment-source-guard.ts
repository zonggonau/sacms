/**
 * Shared, DB-free validation for a deployment's file set — used for a live
 * Vercel read (vercel-client.ts's getDeploymentFiles), for revalidating an
 * already-persisted SaCMS snapshot before it's trusted as an import/patch/
 * rollback base (mcp route handlers), and for checking a live response body
 * against an expected binary format (verify_deployment_url). One shared
 * representation for all three, per chatgpt3.md's explicit ask — a
 * revision considered trustworthy by import must mean the same thing when
 * it's later read back as a patch base or a rollback target.
 *
 * Two concrete bugs this exists to catch (chatgpt3.md, confirmed live
 * against workspace "Ruang Kabar"):
 *  - A wrapper directory ahead of the real project root (e.g. a monorepo
 *    subfolder, or a deployment made by something other than
 *    deployToVercel's own always-root-relative upload) moving
 *    package.json/public/ one level deeper than deployToVercel expects —
 *    the build reports READY while the live site 500s/404s on everything.
 *  - A binary asset (PNG/JPEG/GIF/ICO) whose decoded bytes don't match its
 *    own format's signature — upstream base64/text mishandling silently
 *    corrupting it while an HTTP 200 alone would let it pass.
 */

export interface MinimalDeploymentFile {
  name: string
  content: string
  encoding: "utf-8" | "base64"
}

export const KNOWN_BINARY_SIGNATURES: Record<string, number[]> = {
  png: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  jpg: [0xff, 0xd8, 0xff],
  jpeg: [0xff, 0xd8, 0xff],
  gif: [0x47, 0x49, 0x46, 0x38],
  ico: [0x00, 0x00, 0x01, 0x00],
}

/**
 * Finds the directory wrapping the project's real root, proven only by
 * package.json's own location — the shallowest package.json among the
 * given paths defines the root; everything above it is the wrapper. A
 * legitimate `src/` directory (Next.js's own src-directory convention)
 * never itself contains package.json, so this never strips a real one.
 * Returns "" when package.json is already at the root, or when none is
 * found at all (nothing to prove a wrapper with — left untouched rather
 * than guessed at).
 */
export function detectWrapperPrefix(paths: string[]): string {
  const pkgPaths = paths.filter((p) => p === "package.json" || p.endsWith("/package.json"))
  if (pkgPaths.length === 0) return ""
  const shallowest = pkgPaths.reduce((a, b) => (a.split("/").length <= b.split("/").length ? a : b))
  return shallowest === "package.json" ? "" : shallowest.slice(0, -"/package.json".length)
}

/**
 * Strips a detected wrapper prefix from every leaf under it. A leaf that
 * does NOT sit under the prefix is dropped (reported, not silently kept at
 * its original confusing path) — it isn't part of the real project root.
 */
export function stripWrapperPrefix<T extends { path: string }>(
  leaves: T[],
): { leaves: T[]; dropped: string[] } {
  const prefix = detectWrapperPrefix(leaves.map((l) => l.path))
  if (!prefix) return { leaves, dropped: [] }
  const withSlash = `${prefix}/`
  const kept: T[] = []
  const dropped: string[] = []
  for (const leaf of leaves) {
    if (leaf.path.startsWith(withSlash)) {
      kept.push({ ...leaf, path: leaf.path.slice(withSlash.length) })
    } else {
      dropped.push(leaf.path)
    }
  }
  return { leaves: kept, dropped }
}

function decodeBytes(content: string, encoding: "utf-8" | "base64"): Buffer {
  return encoding === "base64" ? Buffer.from(content, "base64") : Buffer.from(content, "utf-8")
}

export function matchesSignature(format: string, bytes: Buffer): boolean {
  const sig = KNOWN_BINARY_SIGNATURES[format.toLowerCase()]
  if (!sig) return false
  return bytes.length >= sig.length && sig.every((b, i) => bytes[i] === b)
}

/** Paths whose decoded bytes don't match their own extension's known binary signature. */
export function findInvalidBinaryAssets(files: MinimalDeploymentFile[]): string[] {
  const bad: string[] = []
  for (const f of files) {
    const ext = f.name.split(".").pop()?.toLowerCase()
    const sig = ext ? KNOWN_BINARY_SIGNATURES[ext] : undefined
    if (!sig) continue
    if (!matchesSignature(ext!, decodeBytes(f.content, f.encoding))) bad.push(f.name)
  }
  return bad
}

/** Non-empty when a file set shows signs it needs a fresh, validated re-import before being trusted as an import/patch/rollback base. */
export function findSourceIssues(files: MinimalDeploymentFile[]): string[] {
  const issues: string[] = []
  const wrapperPrefix = detectWrapperPrefix(files.map((f) => f.name))
  if (wrapperPrefix) issues.push(`WRAPPER_PREFIX:${wrapperPrefix}`)
  for (const path of findInvalidBinaryAssets(files)) issues.push(`INVALID_ASSET:${path}`)
  return issues
}
