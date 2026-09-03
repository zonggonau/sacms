import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import crypto from "crypto"
import { getTenantDb } from "@/lib/database"
import {
  signMemberAccessToken,
  generateRefreshTokenString,
  REFRESH_TOKEN_TTL_DAYS,
} from "@/lib/member-auth"
import { guardMemberAuth } from "@/lib/member-auth-guard"
import { authCorsPreflight } from "@/lib/member-auth-cors"

export async function OPTIONS(
  request: NextRequest,
  { params }: { params: Promise<{ tenant: string }> },
) {
  const { tenant } = await params
  return authCorsPreflight(request, tenant)
}

const Schema = z.object({ code: z.string().min(1) })

/**
 * Consume the one-time code from a member email-verification link.
 *
 * The register routes store `sha256(code)` in `passwordResetToken` (reusing the
 * reset-token columns) with a 24h expiry. On success the member is marked
 * verified + active and a session is issued so the frontend can sign them
 * straight in.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tenant: string }> },
) {
  let CORS_HEADERS: Record<string, string> = {}
  try {
    const { tenant: tenantSlug } = await params

    const guard = await guardMemberAuth(request, tenantSlug, {
      endpoint: "email-confirmation",
      limit: 10,
      windowSeconds: 300,
    })
    if (!guard.ok) {
      return NextResponse.json(
        { error: guard.error },
        {
          status: guard.status,
          headers: guard.retryAfterSeconds
            ? { ...guard.cors, "Retry-After": String(guard.retryAfterSeconds) }
            : guard.cors,
        },
      )
    }
    const { tenant, ip, cors } = guard.ctx
    CORS_HEADERS = cors
    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404, headers: cors })
    }

    const body = await request.json().catch(() => ({}))
    const parsed = Schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid confirmation code" }, { status: 400, headers: cors })
    }

    const { code } = parsed.data
    const codeHash = crypto.createHash("sha256").update(code).digest("hex")
    const tenantDb = (await getTenantDb(tenant.slug)) as any

    const member = await tenantDb.member.findFirst({
      where: {
        tenantId: tenant.id,
        passwordResetToken: codeHash,
        passwordResetExpires: { gte: new Date() },
      },
    })
    if (!member) {
      return NextResponse.json(
        { error: "Invalid or expired confirmation code" },
        { status: 400, headers: cors },
      )
    }

    // Idempotent: if already verified, just clear the token and succeed.
    await tenantDb.member.update({
      where: { id: member.id },
      data: {
        emailVerified: member.emailVerified ?? new Date(),
        status: member.status === "pending_verification" ? "active" : member.status,
        passwordResetToken: null,
        passwordResetExpires: null,
      },
    })

    const refreshToken = generateRefreshTokenString()
    const sessionExpires = new Date()
    sessionExpires.setDate(sessionExpires.getDate() + REFRESH_TOKEN_TTL_DAYS)
    await tenantDb.memberSession.create({
      data: {
        memberId: member.id,
        tenantId: tenant.id,
        refreshToken,
        userAgent: request.headers.get("user-agent"),
        ipAddress: ip,
        expiresAt: sessionExpires,
      },
    })

    const { token: jwt } = signMemberAccessToken({
      sub: member.id,
      email: member.email,
      tenantId: tenant.id,
      tenantSlug: tenant.slug,
      role: member.role,
    })

    return NextResponse.json(
      {
        jwt,
        refreshToken,
        user: { id: member.id, email: member.email, role: member.role },
      },
      { status: 200, headers: cors },
    )
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message ?? "Internal server error" },
      { status: 500, headers: CORS_HEADERS },
    )
  }
}
