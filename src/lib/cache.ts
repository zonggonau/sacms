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
    
    // Upstash returns object if it's already a JSON, but we'll handle both
    if (typeof data === "string") {
      return JSON.parse(data) as T
    }
    return data as T
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
    await redis.set(key, JSON.stringify(data), { ex: ttlSeconds })
  } catch (error) {
    console.warn(`[Cache] Failed to set key ${key}:`, error)
  }
}

/**
 * Utility to fetch data with a cache-aside pattern.
 */
export async function withCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlSeconds: number = CACHE_TTL
): Promise<T> {
  const cachedData = await getCache<T>(key)
  if (cachedData !== null) {
    return cachedData
  }

  const freshData = await fetcher()
  if (freshData !== null && freshData !== undefined) {
    await setCache(key, freshData, ttlSeconds)
  }
  
  return freshData
}

/**
 * Generate a consistent cache key for content.
 */
export function generateContentCacheKey(tenantSlug: string, type: string, identifier?: string): string {
  return `content:${tenantSlug}:${type}${identifier ? `:${identifier}` : ''}`
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
 */
export async function invalidatePattern(pattern: string): Promise<void> {
  const redis = getRedis()
  if (!redis) return

  try {
    let cursor = 0
    do {
      const [newCursor, keys] = await redis.scan(cursor, {
        match: pattern,
        count: 100
      })
      cursor = Number(newCursor)
      if (keys.length > 0) {
        await redis.del(...keys)
      }
    } while (cursor !== 0)
  } catch (error) {
    console.warn(`[Cache] Failed to invalidate pattern ${pattern}:`, error)
  }
}
