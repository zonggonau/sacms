import { NextResponse } from "next/server"
import { authorizeCronRequest } from "@/lib/cron-auth"
import { generateMonthlyInvoices } from "@/lib/billing/generate-invoices"

export async function GET(request: Request) {
  const unauthorized = authorizeCronRequest(request)
  if (unauthorized) return unauthorized

  const result = await generateMonthlyInvoices()
  return NextResponse.json(result, { status: result.results.failed ? 503 : 200 })
}
