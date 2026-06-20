import { timingSafeEqual } from "crypto"
import { NextResponse } from "next/server"

export function authorizeCronRequest(request: Request): NextResponse | null {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    return NextResponse.json(
      { error: "Cron secret is not configured" },
      { status: 500 }
    )
  }

  const authHeader = request.headers.get("authorization") ?? ""
  const expected = `Bearer ${cronSecret}`
  const authBuffer = Buffer.from(authHeader)
  const expectedBuffer = Buffer.from(expected)

  if (
    authBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(authBuffer, expectedBuffer)
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  return null
}
