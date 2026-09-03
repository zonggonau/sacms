/**
 * Trusted client-IP resolution.
 *
 * `X-Forwarded-For` is a comma-separated chain: `client, proxy1, proxy2, ...`.
 * The left-most entry is fully attacker-controlled — a client can send
 * `X-Forwarded-For: 1.2.3.4` and every proxy in front of us only *appends*.
 * So the trustworthy address is counted from the RIGHT: with N trusted reverse
 * proxies in front of the app, the real client is the (N+1)-th entry from the end.
 *
 * SaCMS runs behind a single Caddy gateway in production, so the default is 1
 * trusted hop. Override with `TRUSTED_PROXY_HOPS` if the topology changes
 * (e.g. Cloudflare -> Caddy -> app would be 2).
 */

const TRUSTED_HOPS = (() => {
  const raw = Number(process.env.TRUSTED_PROXY_HOPS)
  return Number.isFinite(raw) && raw >= 0 ? Math.floor(raw) : 1
})()

const FALLBACK_IP = "127.0.0.1"

function isPlausibleIp(value: string): boolean {
  if (!value) return false
  // IPv4 or (loose) IPv6 — good enough to reject obvious garbage / header injection.
  return /^[0-9a-fA-F:.]+$/.test(value) && value.length <= 45
}

/**
 * Resolve the caller's IP for security decisions (rate limiting, blacklists).
 *
 * Prefers `X-Real-IP` (single value, set by the immediate proxy) and otherwise
 * walks `X-Forwarded-For` from the right by the configured number of trusted hops.
 */
export function getClientIp(request: Request): string {
  const realIp = request.headers.get("x-real-ip")?.trim()
  if (realIp && isPlausibleIp(realIp)) return realIp

  const xff = request.headers.get("x-forwarded-for")
  if (xff) {
    const chain = xff
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
    if (chain.length > 0) {
      // (N+1)-th from the end; clamp so a short chain yields the left-most entry.
      const idx = Math.max(0, chain.length - 1 - TRUSTED_HOPS)
      const candidate = chain[idx]
      if (isPlausibleIp(candidate)) return candidate
    }
  }

  return FALLBACK_IP
}

export function isLoopbackIp(ip: string): boolean {
  return ip === "127.0.0.1" || ip === "::1" || ip === "localhost" || ip.startsWith("127.")
}
