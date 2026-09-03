import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db, getTenantDb } from "@/lib/database"
import { rateLimit } from "@/lib/rate-limit"
import crypto from "crypto"

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
}
export async function OPTIONS() { return new NextResponse(null, { status: 204, headers: CORS_HEADERS }) }

const Schema = z.object({ email: z.string().email() })

export async function POST(request: NextRequest, { params }: { params: Promise<{ tenant: string }> }) {
  try {
    const { tenant: tenantSlug } = await params
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "127.0.0.1"
    const rl = await rateLimit(`auth:forgot:${tenantSlug}:${ip}`, { limit: 5, windowSeconds: 300 })
    if (!rl.success) return NextResponse.json({ error: "Too many requests." }, { status: 429, headers: CORS_HEADERS })

    const tenant = await db.tenant.findFirst({ where: { OR: [{ slug: tenantSlug }, { id: tenantSlug }] }, select: { id: true, slug: true, name: true } })
    if (!tenant) return NextResponse.json({ ok: true }, { status: 200, headers: CORS_HEADERS }) // silent 200

    const body = await request.json().catch(() => ({}))
    const parsed = Schema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: "Invalid email" }, { status: 400, headers: CORS_HEADERS })

    const { email } = parsed.data
    const tenantDb = (await getTenantDb(tenant.slug)) as any
    const member = await tenantDb.member.findFirst({ where: { tenantId: tenant.id, email } })
    if (!member) return NextResponse.json({ ok: true }, { status: 200, headers: CORS_HEADERS }) // silent 200

    // Send the raw token to the user; store only its hash so a DB leak can't be replayed.
    const resetToken = crypto.randomBytes(32).toString("hex")
    const resetTokenHash = crypto.createHash("sha256").update(resetToken).digest("hex")
    const resetExpires = new Date(Date.now() + 60 * 60 * 1000) // 1 hour

    await tenantDb.member.update({ where: { id: member.id }, data: { passwordResetToken: resetTokenHash, passwordResetExpires: resetExpires } })

    // TODO: send email with link: /auth/reset-password?code=${resetToken}
    // For now, return token in development mode only
    if (process.env.NODE_ENV === "development") {
      return NextResponse.json({ ok: true, _dev_resetCode: resetToken }, { status: 200, headers: CORS_HEADERS })
    }

    return NextResponse.json({ ok: true }, { status: 200, headers: CORS_HEADERS })
  } catch (error: any) {
    return NextResponse.json({ error: error.message ?? "Internal server error" }, { status: 500, headers: CORS_HEADERS })
  }
}
