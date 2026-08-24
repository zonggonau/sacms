import { Redis } from "@upstash/redis"

const UPSTASH_REDIS_REST_URL = process.env.UPSTASH_REDIS_REST_URL || ""
const UPSTASH_REDIS_REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || ""

let _redisInstance: Redis | null = null

/**
 * Get Upstash Redis client singleton (Edge compatible).
 * Returns null if Redis is not configured.
 */
export function getRedis(): Redis | null {
  if (!UPSTASH_REDIS_REST_URL || !UPSTASH_REDIS_REST_TOKEN) {
    return null
  }

  if (!_redisInstance) {
    _redisInstance = new Redis({
      url: UPSTASH_REDIS_REST_URL,
      token: UPSTASH_REDIS_REST_TOKEN,
    })
  }

  return _redisInstance
}

/**
 * Check if Redis is available.
 */
export function isRedisAvailable(): boolean {
  return !!(UPSTASH_REDIS_REST_URL && UPSTASH_REDIS_REST_TOKEN)
}

/**
 * Convenience export for redis singleton
 */
export const redis = (UPSTASH_REDIS_REST_URL && UPSTASH_REDIS_REST_TOKEN)
  ? getRedis()
  : null
