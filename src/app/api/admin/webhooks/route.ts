import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/database"

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (session?.user?.role !== "super_admin" && session?.user?.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const [webhooks, recentLogs, deadLetters] = await Promise.all([
      db.webhook.findMany({
        include: {
          tenant: {
            select: { id: true, name: true, slug: true }
          },
          _count: {
            select: { deadLetters: true, logs: true }
          }
        },
        orderBy: { updatedAt: "desc" },
        take: 50
      }),
      db.webhookLog.findMany({
        include: {
          webhook: {
            select: { id: true, name: true, url: true, tenantId: true }
          }
        },
        orderBy: { createdAt: "desc" },
        take: 30
      }),
      db.webhookDeadLetter.findMany({
        include: {
          webhook: {
            select: {
              id: true,
              name: true,
              url: true,
              tenant: { select: { id: true, name: true, slug: true } }
            }
          }
        },
        orderBy: { createdAt: "desc" },
        take: 50
      })
    ])

    return NextResponse.json({
      webhooks,
      recentLogs,
      deadLetters,
      stats: {
        totalWebhooks: webhooks.length,
        activeWebhooks: webhooks.filter(w => w.enabled).length,
        deadLetterCount: deadLetters.length,
        successLogsCount: recentLogs.filter(l => l.success).length,
        failedLogsCount: recentLogs.filter(l => !l.success).length,
      }
    })
  } catch (error: any) {
    console.error("Failed to fetch admin webhooks:", error)
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (session?.user?.role !== "super_admin" && session?.user?.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const { deadLetterId, action } = body

    if (action === "retry" && deadLetterId) {
      const deadLetter = await db.webhookDeadLetter.findUnique({
        where: { id: deadLetterId },
        include: { webhook: true }
      })

      if (!deadLetter) {
        return NextResponse.json({ error: "Dead letter not found" }, { status: 404 })
      }

      // Perform retry delivery
      let statusCode: number | null = null
      let success = false
      let responseBody: any = null
      let errorMsg: string | null = null
      const startTime = Date.now()

      try {
        const payloadData = typeof deadLetter.payload === "string" 
          ? JSON.parse(deadLetter.payload) 
          : deadLetter.payload

        const res = await fetch(deadLetter.webhook.url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-SaCMS-Event": deadLetter.event,
            "X-SaCMS-Delivery": deadLetter.id,
            "X-SaCMS-Retry": String(deadLetter.attempts + 1),
            ...(deadLetter.webhook.headers as Record<string, string> || {}),
          },
          body: JSON.stringify(payloadData),
          signal: AbortSignal.timeout(10000)
        })

        statusCode = res.status
        success = res.ok
        try {
          responseBody = await res.json()
        } catch {
          responseBody = { statusText: res.statusText }
        }
      } catch (err: any) {
        errorMsg = err.message || "Network delivery error"
      }

      const duration = Date.now() - startTime

      // Log the retry attempt
      await db.webhookLog.create({
        data: {
          webhookId: deadLetter.webhookId,
          event: deadLetter.event,
          statusCode,
          success,
          duration,
          error: errorMsg,
          payload: deadLetter.payload as any,
          response: responseBody as any,
        }
      })

      if (success) {
        // Remove from DLQ if delivered successfully
        await db.webhookDeadLetter.delete({
          where: { id: deadLetterId }
        })
        return NextResponse.json({ success: true, message: "Webhook retry delivered successfully" })
      } else {
        // Update attempts and last error
        await db.webhookDeadLetter.update({
          where: { id: deadLetterId },
          data: {
            attempts: { increment: 1 },
            lastError: errorMsg || `HTTP ${statusCode}`,
            updatedAt: new Date()
          }
        })
        return NextResponse.json({ success: false, error: errorMsg || `HTTP ${statusCode}` }, { status: 400 })
      }
    }

    if (action === "purge_all") {
      await db.webhookDeadLetter.deleteMany({})
      return NextResponse.json({ success: true, message: "Dead letter queue purged" })
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  } catch (error: any) {
    console.error("Failed to process webhook action:", error)
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 })
  }
}
