import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getRedis } from "@/lib/redis"

export async function POST() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (session.user.role !== "super_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const redis = getRedis()
    if (redis) {
      try {
        await redis.flushdb()
      } catch (err) {
        console.warn("Redis flushdb warning:", err)
      }
    }

    return NextResponse.json({ success: true, message: "Cache platform berhasil dibersihkan." })
  } catch (error) {
    console.error("Error purging cache:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
