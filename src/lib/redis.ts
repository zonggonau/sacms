import Redis from "ioredis"

const REDIS_URL = process.env.REDIS_URL || ""

let redis: Redis | null = null

/**
 * Get Redis client singleton. Returns null if Redis is not configured.
 */
export function getRedis(): Redis | null {
  if (!REDIS_URL) return null

  if (!redis) {
    redis = new Redis(REDIS_URL, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        if (times > 3) return null // stop retrying
        return Math.min(times * 200, 2000)
      },
      lazyConnect: true,
    })

    redis.on("error", (err) => {
      console.error("Redis connection error:", err.message)
    })

    redis.connect().catch(() => {
      // Will be retried on next command
    })
  }

  return redis
}

/**
 * Check if Redis is available.
 */
export function isRedisAvailable(): boolean {
  return !!(REDIS_URL && redis?.status === "ready")
}
