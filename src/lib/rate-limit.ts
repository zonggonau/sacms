import { getRedis } from "@/lib/redis"

/**
 * Rate limiter with Upstash Redis support (Edge compatible) and in-memory fallback.
 * Uses Redis INCR + EXPIRE for distributed rate limiting.
 */

interface RateLimitEntry {
  count: number
  resetAt: number
}

const store = new Map<string, RateLimitEntry>()

// Cleanup stale entries periodically
if (typeof window === "undefined") {
  setInterval(() => {
    const now = Date.now()
    for (const [key, entry] of store) {
      if (entry.resetAt < now) {
        store.delete(key)
      }
    }
  }, 60_000)
}

interface RateLimitConfig {
  /** Max requests per window */
  limit: number
  /** Window duration in seconds */
  windowSeconds: number
}

interface RateLimitResult {
  success: boolean
  limit: number
  remaining: number
  resetAt: number
}

/**
 * Check rate limit for a given identifier (e.g., IP address or API token).
 * Tries Redis first, falls back to in-memory.
 */
export async function rateLimit(
  identifier: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const redis = getRedis()

  if (redis) {
    try {
      const redisKey = `cf:rl:${identifier}`
      
      // Atomic INCR + EXPIRE using pipeline
      const p = redis.pipeline()
      p.incr(redisKey)
      p.expire(redisKey, config.windowSeconds)
      const results = await p.exec()
      
      const count = results[0] as number
      const resetAt = Date.now() + config.windowSeconds * 1000

      return {
        success: count <= config.limit,
        limit: config.limit,
        remaining: Math.max(0, config.limit - count),
        resetAt,
      }
    } catch (error) {
      console.error("Rate limit Redis error:", error)
      // Fall through to in-memory
    }
  }

  // In-memory fallback
  return rateLimitMemory(identifier, config)
}

/**
 * In-memory rate limit (fallback when Redis is unavailable).
 */
function rateLimitMemory(
  identifier: string,
  config: RateLimitConfig
): RateLimitResult {
  const now = Date.now()
  const key = identifier
  const entry = store.get(key)

  if (!entry || entry.resetAt < now) {
    // New window
    const resetAt = now + config.windowSeconds * 1000
    store.set(key, { count: 1, resetAt })
    return {
      success: true,
      limit: config.limit,
      remaining: config.limit - 1,
      resetAt,
    }
  }

  if (entry.count >= config.limit) {
    return {
      success: false,
      limit: config.limit,
      remaining: 0,
      resetAt: entry.resetAt,
    }
  }

  entry.count++
  return {
    success: true,
    limit: config.limit,
    remaining: config.limit - entry.count,
    resetAt: entry.resetAt,
  }
}

/** Preset rate limit configs */
export const RATE_LIMITS = {
  /** Public API: 1000 requests per minute per token */
  publicApi: { limit: 1000, windowSeconds: 60 },
  /** Auth endpoints: 200 attempts per minute per IP to avoid blocking next-auth internal fetchers */
  auth: { limit: 200, windowSeconds: 60 },
  /** Dashboard API: 300 requests per minute per user */
  api: { limit: 300, windowSeconds: 60 },
} as const

/**
 * Returns rate limit configuration based on tenant plan.
 */
export function getTenantRateLimit(plan: string): RateLimitConfig {
  switch (plan?.toLowerCase()) {
    case "enterprise":
      return { limit: 2000, windowSeconds: 60 } // 2000 RPM
    case "pro":
      return { limit: 1000, windowSeconds: 60 } // 1000 RPM
    case "starter":
      return { limit: 500, windowSeconds: 60 } // 500 RPM
    case "free":
    default:
      return { limit: 100, windowSeconds: 60 } // 100 RPM
  }
}
