import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getTenantDb } from "@/lib/database"
import { verifyMemberPassword, hashMemberPassword, signMemberAccessToken, generateRefreshTokenString, REFRESH_TOKEN_TTL_DAYS } from "@/lib/member-auth"
import { getClientIp } from "@/lib/client-ip"
import { authCorsPreflight } from "@/lib/member-auth-cors"
import { resolveMemberRequest } from "@/lib/member-request"

export async function OPTIONS(
  request: NextRequest,
  { params }: { params: Promise<{ tenant: string }> },
) {
  const { tenant } = await params
  return authCorsPreflight(request, tenant)
}

const Schema = z.object({
  currentPassword: z.string().min(1),
  password: z.string().min(8).max(128),
  passwordConfirmation: z.string().min(8).max(128),
}).refine(d => d.password === d.passwordConfirmation, { message: "Passwords do not match", path: ["passwordConfirmation"] })

export async function POST(request: NextRequest, { params }: { params: Promise<{ tenant: string }> }) {
  try {
    const { tenant: tenantSlug } = await params
    const auth = await resolveMemberRequest(request, tenantSlug)
    if (!auth.ok) return auth.response
    const { cors: CORS_HEADERS, tenant, payload } = auth

    const body = await request.json().catch(() => ({}))
    const parsed = Schema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: "Validation failed", details: parsed.error.format() }, { status: 400, headers: CORS_HEADERS })

    const { currentPassword, password } = parsed.data
    const tenantDb = (await getTenantDb(tenant.slug)) as any
    const member = await tenantDb.member.findUnique({ where: { id: payload.sub } })
    if (!member || member.status !== "active") return NextResponse.json({ error: "Member not found" }, { status: 404, headers: CORS_HEADERS })

    const valid = await verifyMemberPassword(currentPassword, member.passwordHash)
    if (!valid) return NextResponse.json({ error: "currentPassword is incorrect" }, { status: 400, headers: CORS_HEADERS })

    const passwordHash = await hashMemberPassword(password)
    await tenantDb.member.update({ where: { id: member.id }, data: { passwordHash } })

    // Invalidate every other session after a password change
    await tenantDb.memberSession.deleteMany({ where: { memberId: member.id } })

    const refreshToken = generateRefreshTokenString()
    const sessionExpires = new Date(); sessionExpires.setDate(sessionExpires.getDate() + REFRESH_TOKEN_TTL_DAYS)
    const ip = getClientIp(request)
    await tenantDb.memberSession.create({ data: { memberId: member.id, tenantId: tenant.id, refreshToken, userAgent: request.headers.get("user-agent"), ipAddress: ip, expiresAt: sessionExpires } })

    const { token: jwt } = signMemberAccessToken({ sub: member.id, email: member.email, tenantId: tenant.id, tenantSlug: tenant.slug, role: member.role })

    return NextResponse.json({
      jwt,
      refreshToken,
      user: { id: member.id, email: member.email, role: member.role },
    }, { status: 200, headers: CORS_HEADERS })
  } catch (error) {
    console.error("[public-auth/change-password]", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
