const MAX_PATH_LENGTH = 200
const BLOCKED_SEGMENTS = new Set(["node_modules", ".next", ".git", ".vercel"])

/**
 * Normalizes a path the agent wants to write inside the app root, or returns
 * null when it would escape the root or touch generated/secret locations.
 */
export function normalizeProjectPath(raw: string): string | null {
  const path = raw.trim().replace(/\\/g, "/").replace(/^\.\//, "")
  if (!path || path.length > MAX_PATH_LENGTH || path.startsWith("/")) return null
  if (/[\0\r\n]/.test(path)) return null

  const segments = path.split("/")
  if (segments.some((segment) => !segment || segment === "." || segment === "..")) return null
  if (segments.some((segment) => BLOCKED_SEGMENTS.has(segment))) return null
  if (/^\.env(\..*)?$/.test(segments.at(-1)!) && segments.at(-1) !== ".env.example") return null

  return segments.join("/")
}
