import { NextResponse } from "next/server"
import { authorizeCronRequest } from "@/lib/cron-auth"
import { runBillingReminders } from "@/lib/billing/reminders"

export const dynamic = "force-dynamic"

/**
 * GET /api/cron/billing-reminders
 * Daily: expiry reminders for storage add-ons and managed database/storage services, and
 * expiry of unpaid managed services. Requires `Authorization: Bearer CRON_SECRET`.
 */
export async function GET(request: Request) {
  const unauthorized = authorizeCronRequest(request)
  if (unauthorized) return unauthorized

  try {
    const result = await runBillingReminders()
    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    console.error("[cron/billing-reminders]", error)
    return NextResponse.json({ error: "Billing reminders failed" }, { status: 500 })
  }
}
