import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getTenantDb } from "@/lib/database"
import { guardMemberAuth } from "@/lib/member-auth-guard"
import { authCorsPreflight } from "@/lib/member-auth-cors"
import crypto from "crypto"

export async function OPTIONS(
  request: NextRequest,
  { params }: { params: Promise<{ tenant: string }> }
) {
  const { tenant } = await params
  return authCorsPreflight(request, tenant)
}

const Schema = z.object({ email: z.string().email() })

export async function POST(request: NextRequest, { params }: { params: Promise<{ tenant: string }> }) {
  try {
    const { tenant: tenantSlug } = await params

    const guard = await guardMemberAuth(request, tenantSlug, {
      endpoint: "forgot",
      limit: 5,
      windowSeconds: 300,
      allowUnknownTenant: true,
    })
    if (!guard.ok) {
      return NextResponse.json({ error: guard.error }, {
        status: guard.status,
        headers: guard.retryAfterSeconds
          ? { ...guard.cors, "Retry-After": String(guard.retryAfterSeconds) }
          : guard.cors,
      })
    }
    const { tenant, cors: CORS_HEADERS } = guard.ctx
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
