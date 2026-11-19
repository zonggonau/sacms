import { NextResponse } from "next/server"
import { authorizeCronRequest } from "@/lib/cron-auth"
import { retryPendingPaymentFulfillments } from "@/lib/billing/payment-success"

export async function GET(request: Request) {
  const unauthorized = authorizeCronRequest(request)
  if (unauthorized) return unauthorized

  const result = await retryPendingPaymentFulfillments()
  return NextResponse.json(result, { status: result.failed > 0 ? 503 : 200 })
}
