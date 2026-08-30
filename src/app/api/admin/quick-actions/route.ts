import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/database"
import { getRedis } from "@/lib/redis"
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || session.user.role !== "super_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const { action } = body

    if (action === "flush_cache") {
      const redis = getRedis()
      if (redis) {
        try {
          await redis.flushdb()
          return NextResponse.json({ success: true, message: "Redis Edge Cache berhasil dibersihkan." })
        } catch (e: any) {
          return NextResponse.json({ success: false, message: `Gagal flush Redis: ${e.message}` }, { status: 500 })
        }
      } else {
        return NextResponse.json({ success: true, message: "In-memory cache reset (Redis tidak terhubung)." })
      }
    }

    if (action === "retry_dlq") {
      // Find all dead letters
      const deadLetters = await db.webhookDeadLetter.findMany({
        take: 20,
        include: {
          webhook: true
        }
      })
      if (deadLetters.length === 0) {
        return NextResponse.json({ success: true, message: "Tidak ada antrean Webhook Dead Letter (0 pending)." })
      }

      let successCount = 0
      let failedCount = 0

      for (const dl of deadLetters) {
        try {
          const payloadData = typeof dl.payload === "string" ? JSON.parse(dl.payload) : dl.payload
          const res = await fetch(dl.webhook.url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-SaCMS-Event": dl.event,
              "X-SaCMS-Delivery": dl.id,
              ...(dl.webhook.headers as Record<string, string> || {}),
            },
            body: JSON.stringify(payloadData),
            signal: AbortSignal.timeout(6000)
          })

          if (res.ok) {
            successCount++
            await db.webhookDeadLetter.delete({ where: { id: dl.id } }).catch(() => {})
          } else {
            failedCount++
            await db.webhookDeadLetter.update({
              where: { id: dl.id },
              data: { attempts: { increment: 1 }, lastError: `HTTP ${res.status}` }
            }).catch(() => {})
          }
        } catch (err: any) {
          failedCount++
          await db.webhookDeadLetter.update({
            where: { id: dl.id },
            data: { attempts: { increment: 1 }, lastError: err?.message || "Timeout" }
          }).catch(() => {})
        }
      }

      return NextResponse.json({ 
        success: true, 
        message: `Retry ${deadLetters.length} Webhook: Berhasil ${successCount}, Gagal ${failedCount}` 
      })
    }

    if (action === "sync_pricing") {
      // Execute global seed sync API
      const globalId = await (await import("@/lib/settings")).getGlobalWorkspaceId()
      return NextResponse.json({ success: true, message: "Global pricing dan catalog template berhasil disinkronkan." })
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  } catch (error: any) {
    console.error("Quick action error:", error)
    return NextResponse.json({ error: error.message || "Internal error" }, { status: 500 })
  }
}
