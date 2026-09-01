import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db, getTenantDb } from "@/lib/database"
import { 
  signMemberAccessToken, 
  generateRefreshTokenString, 
  REFRESH_TOKEN_TTL_DAYS 
} from "@/lib/member-auth"

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-api-key",
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

const RefreshSchema = z.object({
  refreshToken: z.string().min(1, "Refresh token wajib diisi"),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tenant: string }> }
) {
  try {
    const { tenant: tenantSlug } = await params
    const body = await request.json().catch(() => ({}))
    const parsed = RefreshSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation error", details: parsed.error.format() },
        { status: 400, headers: CORS_HEADERS }
      )
    }

    const { refreshToken } = parsed.data
    const tenantDb = (await getTenantDb(tenantSlug)) as any

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

    if (!session) {
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

    const forwardedFor = request.headers.get("x-forwarded-for")
    const clientIp = forwardedFor ? forwardedFor.split(",")[0].trim() : session.ipAddress
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

    // 3. Sign new JWT Access Token
    const { token: accessToken, expiresIn } = signMemberAccessToken({
      sub: session.member.id,
      email: session.member.email,
      tenantId: session.member.tenantId,
      tenantSlug,
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
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to refresh token" }, { status: 500, headers: CORS_HEADERS })
  }
}
