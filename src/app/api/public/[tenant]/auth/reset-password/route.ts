import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import crypto from "crypto"
import { getTenantDb } from "@/lib/database"
import { hashMemberPassword, signMemberAccessToken, generateRefreshTokenString, REFRESH_TOKEN_TTL_DAYS } from "@/lib/member-auth"
import { guardMemberAuth } from "@/lib/member-auth-guard"
import { authCorsPreflight } from "@/lib/member-auth-cors"

export async function OPTIONS(
  request: NextRequest,
  { params }: { params: Promise<{ tenant: string }> }
) {
  const { tenant } = await params
  return authCorsPreflight(request, tenant)
}

const Schema = z.object({
  code: z.string().min(1),
  password: z.string().min(8),
  passwordConfirmation: z.string().min(8),
}).refine(d => d.password === d.passwordConfirmation, { message: "Passwords do not match", path: ["passwordConfirmation"] })

export async function POST(request: NextRequest, { params }: { params: Promise<{ tenant: string }> }) {
  let CORS_HEADERS: Record<string, string> = {}
  try {
    const { tenant: tenantSlug } = await params

    const guard = await guardMemberAuth(request, tenantSlug, {
      endpoint: "reset",
      limit: 10,
      windowSeconds: 300,
    })
    if (!guard.ok) {
      return NextResponse.json({ error: guard.error }, {
        status: guard.status,
        headers: guard.retryAfterSeconds
          ? { ...guard.cors, "Retry-After": String(guard.retryAfterSeconds) }
          : guard.cors,
      })
    }
    const { tenant, ip, cors } = guard.ctx
    CORS_HEADERS = cors
    if (!tenant) return NextResponse.json({ error: "Tenant not found" }, { status: 404, headers: CORS_HEADERS })

    const body = await request.json().catch(() => ({}))
    const parsed = Schema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: "Validation failed", details: parsed.error.format() }, { status: 400, headers: CORS_HEADERS })

    const { code, password } = parsed.data
    const codeHash = crypto.createHash("sha256").update(code).digest("hex")
    const tenantDb = (await getTenantDb(tenant.slug)) as any
    const member = await tenantDb.member.findFirst({
      where: { tenantId: tenant.id, passwordResetToken: codeHash, passwordResetExpires: { gte: new Date() } },
    })
    if (!member) return NextResponse.json({ error: "Invalid or expired reset code" }, { status: 400, headers: CORS_HEADERS })

    const passwordHash = await hashMemberPassword(password)
    await tenantDb.member.update({ where: { id: member.id }, data: { passwordHash, passwordResetToken: null, passwordResetExpires: null } })

    // Revoke all existing sessions
    await tenantDb.memberSession.deleteMany({ where: { memberId: member.id } })

    const refreshToken = generateRefreshTokenString()
    const sessionExpires = new Date(); sessionExpires.setDate(sessionExpires.getDate() + REFRESH_TOKEN_TTL_DAYS)
    await tenantDb.memberSession.create({ data: { memberId: member.id, tenantId: tenant.id, refreshToken, userAgent: request.headers.get("user-agent"), ipAddress: ip, expiresAt: sessionExpires } })

    const { token: jwt } = signMemberAccessToken({ sub: member.id, email: member.email, tenantId: tenant.id, tenantSlug: tenant.slug, role: member.role })

    return NextResponse.json({
      jwt,
      refreshToken,
      user: { id: member.id, email: member.email, role: member.role },
    }, { status: 200, headers: CORS_HEADERS })
  } catch (error: any) {
    return NextResponse.json({ error: error.message ?? "Internal server error" }, { status: 500, headers: CORS_HEADERS })
  }
}
