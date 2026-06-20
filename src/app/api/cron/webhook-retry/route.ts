import { NextResponse } from "next/server"
import { processWebhookRetries } from "@/lib/webhooks"
import { authorizeCronRequest } from "@/lib/cron-auth"

/**
 * GET /api/cron/webhook-retry
 * Cron job to process webhook Dead Letter Queue retries.
 * Should be called every 1-2 minutes.
 */
export async function GET(request: Request) {
  const unauthorized = authorizeCronRequest(request)
  if (unauthorized) return unauthorized

  try {
    const result = await processWebhookRetries()

    return NextResponse.json({
      ...result,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("Webhook retry cron error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
