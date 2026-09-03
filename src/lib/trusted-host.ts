import { getRedis } from "@/lib/redis"

/**
 * Guard against host-header injection. Returns a `proto://host` origin only when
 * `host` is one we actually serve:
 *   - the platform root domain and its subdomains (api./cms./admin./…)
 *   - localhost (any port) in dev
 *   - a tenant custom domain registered in Redis (`domain:<host>`)
 * Otherwise falls back to NEXTAUTH_URL / NEXT_PUBLIC_APP_URL / the prod default.
 *
 * Used where the request host would otherwise flow into a redirect target,
 * an email link, or NEXTAUTH_URL.
 */

const ROOT_DOMAIN = (process.env.NEXT_PUBLIC_ROOT_DOMAIN || "sacms.cloud").toLowerCase()

function fallbackOrigin(): string {
  const env =
    (process.env.NEXTAUTH_URL && !process.env.NEXTAUTH_URL.includes("localhost")
      ? process.env.NEXTAUTH_URL
      : null) ||
    (process.env.NEXT_PUBLIC_APP_URL?.startsWith("http")
      ? process.env.NEXT_PUBLIC_APP_URL
      : null)
  if (env) return env.replace(/\/$/, "")
  return process.env.NODE_ENV === "production"
    ? `https://${ROOT_DOMAIN}`
    : "http://localhost:3000"
}

function isPlatformHost(host: string): boolean {
  const h = host.toLowerCase().split(":")[0]
  if (h === "localhost" || h.endsWith(".localhost") || h === "127.0.0.1") return true
  return h === ROOT_DOMAIN || h.endsWith(`.${ROOT_DOMAIN}`)
}

async function isRegisteredCustomDomain(host: string): Promise<boolean> {
  const redis = getRedis()
  if (!redis) return false
  try {
    return Boolean(await redis.get<string>(`domain:${host.toLowerCase()}`))
  } catch {
    return false
  }
}

/**
 * Resolve a safe absolute origin (`proto://host`) for the request, or the
 * configured fallback if the request host isn't one we recognise.
 */
export async function resolveTrustedOrigin(req: {
  headers: { get(name: string): string | null }
}): Promise<string> {
  const rawHost =
    req.headers.get("x-forwarded-host") || req.headers.get("host") || ""
  const host = rawHost.split(",")[0].trim()
  if (!host) return fallbackOrigin()

  const proto =
    req.headers.get("x-forwarded-proto")?.split(",")[0].trim() ||
    (host.includes("localhost") || host.startsWith("127.") ? "http" : "https")

  if (isPlatformHost(host) || (await isRegisteredCustomDomain(host))) {
    return `${proto}://${host}`
  }
  return fallbackOrigin()
}

/** Synchronous variant — platform hosts + localhost only, no Redis lookup. */
export function resolveTrustedOriginSync(req: {
  headers: { get(name: string): string | null }
}): string {
  const rawHost =
    req.headers.get("x-forwarded-host") || req.headers.get("host") || ""
  const host = rawHost.split(",")[0].trim()
  if (!host) return fallbackOrigin()
  const proto =
    req.headers.get("x-forwarded-proto")?.split(",")[0].trim() ||
    (host.includes("localhost") || host.startsWith("127.") ? "http" : "https")
  return isPlatformHost(host) ? `${proto}://${host}` : fallbackOrigin()
}
