import { lookup } from "dns/promises"
import net from "net"
import path from "path"

/**
 * SSRF guard for server-side fetches of user-supplied URLs.
 *
 * `assertPublicUrl` rejects anything that isn't a plain http(s) URL resolving to
 * a public IP address — no loopback, private, link-local, or unique-local
 * ranges, no `file:`/`gopher:`/etc. Call it before every `fetch()` of a URL that
 * a tenant, member, or anonymous caller can influence (webhooks, image proxy,
 * template fetch, AI "base URL", …).
 */

export class SsrfError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "SsrfError"
  }
}

function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number)
    if (a === 10) return true
    if (a === 127) return true
    if (a === 0) return true
    if (a === 169 && b === 254) return true // link-local
    if (a === 172 && b >= 16 && b <= 31) return true
    if (a === 192 && b === 168) return true
    if (a === 100 && b >= 64 && b <= 127) return true // CGNAT
    if (a >= 224) return true // multicast / reserved
    return false
  }
  if (net.isIPv6(ip)) {
    const norm = ip.toLowerCase()
    if (norm === "::1" || norm === "::") return true
    if (norm.startsWith("fe80:")) return true // link-local
    if (norm.startsWith("fc") || norm.startsWith("fd")) return true // unique-local
    // IPv4-mapped (::ffff:a.b.c.d)
    const mapped = norm.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/)
    if (mapped) return isPrivateIp(mapped[1])
    return false
  }
  return true // unknown format → treat as unsafe
}

/**
 * Throws {@link SsrfError} if `input` is not a fetch-safe public URL.
 * Returns the parsed, normalised URL on success.
 */
export async function assertPublicUrl(
  input: string,
  opts: { allowHttp?: boolean } = {},
): Promise<URL> {
  let url: URL
  try {
    url = new URL(input)
  } catch {
    throw new SsrfError("Not a valid URL")
  }

  const scheme = url.protocol.replace(":", "")
  if (scheme !== "https" && !(opts.allowHttp && scheme === "http")) {
    throw new SsrfError(`Blocked URL scheme: ${scheme}`)
  }

  const host = url.hostname
  if (
    host === "localhost" ||
    host === "0.0.0.0" ||
    host.endsWith(".localhost") ||
    host.endsWith(".internal") ||
    host.endsWith(".local")
  ) {
    throw new SsrfError("Blocked host")
  }

  // If the host is already a literal IP, check it directly.
  if (net.isIP(host)) {
    if (isPrivateIp(host)) throw new SsrfError("URL resolves to a private address")
    return url
  }

  // Otherwise resolve every A/AAAA record and reject if any is private.
  let records: { address: string }[]
  try {
    records = await lookup(host, { all: true })
  } catch {
    throw new SsrfError("Host does not resolve")
  }
  if (records.length === 0) throw new SsrfError("Host does not resolve")
  for (const r of records) {
    if (isPrivateIp(r.address)) {
      throw new SsrfError("URL resolves to a private address")
    }
  }

  return url
}

/**
 * Resolve a request-relative or absolute path against a base directory, throwing
 * if the result escapes the base (path traversal). Returns the safe absolute
 * path.
 */
export function resolveWithinBase(base: string, ...segments: string[]): string {
  const resolvedBase = path.resolve(base)
  const target = path.resolve(resolvedBase, ...segments.map((s) => s.replace(/^[/\\]+/, "")))
  if (target !== resolvedBase && !target.startsWith(resolvedBase + path.sep)) {
    throw new SsrfError("Path escapes the allowed directory")
  }
  return target
}
