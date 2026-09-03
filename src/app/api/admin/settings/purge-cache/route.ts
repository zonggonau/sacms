import { NextResponse } from "next/server"
import { getRedis } from "@/lib/redis"
import { withAdminAuth } from "@/lib/api/route-helpers"

export const POST = withAdminAuth(async () => {
  const redis = getRedis()
  if (redis) {
    try {
      await redis.flushdb()
    } catch (err) {
      console.warn("Redis flushdb warning:", err)
    }
  }
  return NextResponse.json({ success: true, message: "Cache platform berhasil dibersihkan." })
})
