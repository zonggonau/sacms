import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getTenantDb } from "@/lib/database"
import {
  signMemberAccessToken,
  generateRefreshTokenString,
  REFRESH_TOKEN_TTL_DAYS,
} from "@/lib/member-auth"
import { getClientIp } from "@/lib/client-ip"
import { guardMemberAuth } from "@/lib/member-auth-guard"
import { authCorsPreflight } from "@/lib/member-auth-cors"

export async function OPTIONS(
  request: NextRequest,
  { params }: { params: Promise<{ tenant: string }> },
) {
  const { tenant } = await params
  return authCorsPreflight(request, tenant)
}

const RefreshSchema = z.object({
  refreshToken: z.string().min(1, "Refresh token wajib diisi"),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tenant: string }> }
) {
  let CORS_HEADERS: Record<string, string> = {}
  try {
    const { tenant: tenantSlug } = await params

    const guard = await guardMemberAuth(request, tenantSlug, {
      endpoint: "refresh",
      limit: 20,
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
    const { tenant, cors } = guard.ctx
    CORS_HEADERS = cors
    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404, headers: cors })
    }

    const body = await request.json().catch(() => ({}))
    const parsed = RefreshSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation error", details: parsed.error.format() },
        { status: 400, headers: CORS_HEADERS }
      )
    }

    const { refreshToken } = parsed.data
    const tenantDb = (await getTenantDb(tenant.slug)) as any

    // Find active session
    const session = await tenantDb.memberSession.findUnique({
      where: { refreshToken },
      include: {
        member: {
          select: {
            id: true,
            email: true,
            role: true,
            status: true,
            tenantId: true,
          }
        }
      }
    })

    if (!session || session.tenantId !== tenant.id) {
      return NextResponse.json({ error: "Invalid refresh token" }, { status: 401, headers: CORS_HEADERS })
    }

    // Check if token was revoked (replay attack indicator)
    if (session.revokedAt) {
      // Security: Revoke all active sessions of this member to protect against compromised tokens
      await tenantDb.memberSession.updateMany({
        where: { memberId: session.memberId, revokedAt: null },
        data: { revokedAt: new Date() }
      })
      return NextResponse.json(
        { error: "Compromised refresh token detected. All sessions revoked for safety." },
        { status: 401, headers: CORS_HEADERS }
      )
    }

    // Check expiration
    if (session.expiresAt <= new Date()) {
      return NextResponse.json({ error: "Refresh token has expired. Please login again." }, { status: 401, headers: CORS_HEADERS })
    }

    if (session.member.status !== "active") {
      return NextResponse.json({ error: "Member account is inactive or suspended." }, { status: 403, headers: CORS_HEADERS })
    }

    // ── Token Rotation ───────────────────────────────────────────────────────
    // 1. Invalidate old refresh token
    await tenantDb.memberSession.update({
      where: { id: session.id },
      data: { revokedAt: new Date() }
    })

    // 2. Issue new fresh refresh token
    const newRefreshToken = generateRefreshTokenString()
    const newExpiresAt = new Date()
    newExpiresAt.setDate(newExpiresAt.getDate() + REFRESH_TOKEN_TTL_DAYS)

    const clientIp = getClientIp(request) || session.ipAddress
    const userAgent = request.headers.get("user-agent") || session.userAgent

    await tenantDb.memberSession.create({
      data: {
        memberId: session.member.id,
        tenantId: session.tenantId,
        refreshToken: newRefreshToken,
        userAgent,
        ipAddress: clientIp,
        expiresAt: newExpiresAt,
      }
    })

    // 3. Sign new JWT Access Token — tenantId and tenantSlug both from the
    //    resolved tenant so they can never disagree.
    const { token: accessToken, expiresIn } = signMemberAccessToken({
      sub: session.member.id,
      email: session.member.email,
      tenantId: tenant.id,
      tenantSlug: tenant.slug,
      role: session.member.role,
    })

    return NextResponse.json(
      {
        message: "Token refreshed successfully",
        accessToken,
        refreshToken: newRefreshToken,
        expiresIn,
        tokenType: "Bearer",
      },
      { status: 200, headers: CORS_HEADERS }
    )
  } catch (error) {
    console.error("[public-auth/refresh]", error)
    return NextResponse.json({ error: "Failed to refresh token" }, { status: 500, headers: CORS_HEADERS })
  }
}
