import { getRedis } from "./redis"

export interface GeoIpResult {
  ip: string
  isPrivate: boolean
  countryCode?: string
  countryName?: string
  city?: string
  region?: string
  flag: string
  isp?: string
}

// In-memory LRU-like cache for fast lookups
const inMemoryGeoCache = new Map<string, { data: GeoIpResult; expiresAt: number }>()
const CACHE_TTL_MS = 1000 * 60 * 60 * 24 // 24 hours in-memory

/**
 * Checks if an IP address belongs to a private/loopback/local range.
 */
export function isPrivateIp(ip?: string | null): boolean {
  if (!ip) return true
  const cleanIp = ip.trim()

  if (
    cleanIp === "::1" ||
    cleanIp === "127.0.0.1" ||
    cleanIp === "localhost" ||
    cleanIp === "0.0.0.0" ||
    cleanIp.startsWith("::ffff:127.")
  ) {
    return true
  }

  // IPv4 Private Ranges
  // 10.0.0.0 - 10.255.255.255
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(cleanIp)) return true
  // 172.16.0.0 - 172.31.255.255
  if (/^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(cleanIp)) return true
  // 192.168.0.0 - 192.168.255.255
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(cleanIp)) return true

  // IPv6 Link-local / Unique Local
  if (/^fe80:/i.test(cleanIp) || /^fc00:/i.test(cleanIp) || /^fd00:/i.test(cleanIp)) return true

  return false
}

/**
 * Converts a 2-letter ISO country code to an emoji flag.
 */
export function getCountryFlagEmoji(countryCode?: string | null): string {
  if (!countryCode) return "🌐"
  const code = countryCode.toUpperCase().trim()
  if (code === "LOCAL" || code === "PRIVATE" || code === "DEV") return "🏠"
  if (code === "XX" || code === "UN" || code === "UNKNOWN") return "🌐"
  if (code.length !== 2 || !/^[A-Z]{2}$/.test(code)) return "🌐"

  const codePoints = [...code].map((char) => 0x1f1e6 + char.charCodeAt(0) - 65)
  return String.fromCodePoint(...codePoints)
}

/**
 * Resolves geolocation for a single IP address with multi-tier caching (Memory + Redis + API).
 */
export async function lookupGeoIp(ip?: string | null): Promise<GeoIpResult> {
  const targetIp = (ip || "::1").trim()

  // 1. Private / Local Range Check
  if (isPrivateIp(targetIp)) {
    return {
      ip: targetIp,
      isPrivate: true,
      countryCode: "LOCAL",
      countryName: "Localhost / Private Network",
      city: "Local Network",
      flag: "🏠",
    }
  }

  // 2. In-Memory Cache Check
  const cachedMem = inMemoryGeoCache.get(targetIp)
  if (cachedMem && cachedMem.expiresAt > Date.now()) {
    return cachedMem.data
  }

  // 3. Upstash Redis Cache Check
  const redis = getRedis()
  const redisKey = `geoip:${targetIp}`
  if (redis) {
    try {
      const cachedRedis = (await redis.get(redisKey)) as GeoIpResult | null
      if (cachedRedis) {
        inMemoryGeoCache.set(targetIp, {
          data: cachedRedis,
          expiresAt: Date.now() + CACHE_TTL_MS,
        })
        return cachedRedis
      }
    } catch {
      // Continue if redis fails
    }
  }

  // 4. External Geolocation Lookup (ipwho.is with fallback)
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 2500)

    const res = await fetch(`https://ipwho.is/${encodeURIComponent(targetIp)}`, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
      next: { revalidate: 86400 }, // 24h cache in Next.js
    })
    clearTimeout(timeoutId)

    if (res.ok) {
      const data = await res.json()
      if (data.success) {
        const countryCode = data.country_code || "XX"
        const result: GeoIpResult = {
          ip: targetIp,
          isPrivate: false,
          countryCode,
          countryName: data.country || "Unknown Country",
          city: data.city || "",
          region: data.region || "",
          flag: data.flag?.emoji || getCountryFlagEmoji(countryCode),
          isp: data.connection?.isp || data.connection?.org || "",
        }

        // Save to in-memory & Redis
        inMemoryGeoCache.set(targetIp, {
          data: result,
          expiresAt: Date.now() + CACHE_TTL_MS,
        })

        if (redis) {
          redis.set(redisKey, result, { ex: 60 * 60 * 24 * 7 }).catch(() => {})
        }

        return result
      }
    }
  } catch {
    // Lookup failed or timed out
  }

  // 5. Fallback Result
  const fallbackResult: GeoIpResult = {
    ip: targetIp,
    isPrivate: false,
    countryCode: "XX",
    countryName: "Unknown Location",
    flag: "🌐",
  }

  inMemoryGeoCache.set(targetIp, {
    data: fallbackResult,
    expiresAt: Date.now() + 1000 * 60 * 10, // 10 min cache for failed lookups
  })

  return fallbackResult
}
