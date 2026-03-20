import { getRedis } from "./redis"

const CACHE_TTL = 60 * 5 // 5 minutes default TTL

/**
 * Get data from Redis cache.
 * Returns null if cache miss or Redis is unavailable.
 */
export async function getCache<T>(key: string): Promise<T | null> {
  const redis = getRedis()
  if (!redis) return null

  try {
    const data = await redis.get(key)
    if (!data) return null
    return JSON.parse(data) as T
  } catch (error) {
    console.warn(`[Cache] Failed to get key ${key}:`, error)
    return null
  }
}

/**
 * Set data to Redis cache with TTL (Time To Live).
 */
export async function setCache(key: string, data: any, ttlSeconds: number = CACHE_TTL): Promise<void> {
  const redis = getRedis()
  if (!redis) return

  try {
    await redis.setex(key, ttlSeconds, JSON.stringify(data))
  } catch (error) {
    console.warn(`[Cache] Failed to set key ${key}:`, error)
  }
}

/**
 * Invalidate/delete cache by exact key.
 */
export async function invalidateCache(key: string): Promise<void> {
  const redis = getRedis()
  if (!redis) return

  try {
    await redis.del(key)
  } catch (error) {
    console.warn(`[Cache] Failed to delete key ${key}:`, error)
  }
}

/**
 * Invalidate all cache keys matching a pattern.
 * E.g., invalidatePattern('tenant_a:content:*')
 */
export async function invalidatePattern(pattern: string): Promise<void> {
  const redis = getRedis()
  if (!redis) return

  try {
    let cursor = "0"
    do {
      // SCAN is safer than KEYS for production Redis
      const [newCursor, keys] = await redis.scan(cursor, "MATCH", pattern, "COUNT", 100)
      cursor = newCursor
      if (keys.length > 0) {
        await redis.del(...keys)
      }
    } while (cursor !== "0")
  } catch (error) {
    console.warn(`[Cache] Failed to invalidate pattern ${pattern}:`, error)
  }
}
