import { NextResponse } from "next/server"
import { authorizeCronRequest } from "@/lib/cron-auth"
import { publishScheduledContent } from "@/lib/content/scheduled-publishing"

export async function GET(request: Request) {
  const unauthorized = authorizeCronRequest(request)
  if (unauthorized) return unauthorized

  const result = await publishScheduledContent()
  return NextResponse.json(result, { status: result.failed ? 503 : 200 })
}
