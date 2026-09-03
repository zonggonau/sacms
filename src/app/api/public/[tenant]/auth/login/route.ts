import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getTenantDb } from "@/lib/database"
import { 
  verifyMemberPassword, 
  signMemberAccessToken, 
  generateRefreshTokenString, 
  REFRESH_TOKEN_TTL_DAYS 
} from "@/lib/member-auth"
import { guardMemberAuth } from "@/lib/member-auth-guard"
import { authCorsPreflight } from "@/lib/member-auth-cors"

export async function OPTIONS(
  request: NextRequest,
  { params }: { params: Promise<{ tenant: string }> }
) {
  const { tenant } = await params
  return authCorsPreflight(request, tenant)
}

const LoginSchema = z.object({
  email: z.string().email("Format email tidak valid").toLowerCase().trim(),
  password: z.string().min(1, "Password wajib diisi"),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tenant: string }> }
) {
  let CORS_HEADERS: Record<string, string> = {}
  try {
    const { tenant: tenantSlug } = await params
    if (!tenantSlug) {
      return NextResponse.json({ error: "Tenant identifier required" }, { status: 400 })
    }

    const guard = await guardMemberAuth(request, tenantSlug, {
      endpoint: "login",
      limit: 10,
      windowSeconds: 60,
    })
    if (!guard.ok) {
      return NextResponse.json({ error: guard.error }, {
        status: guard.status,
        headers: guard.retryAfterSeconds
          ? { ...guard.cors, "Retry-After": String(guard.retryAfterSeconds) }
          : guard.cors,
      })
    }
    const { tenant, ip: clientIp, cors } = guard.ctx
    CORS_HEADERS = cors
    if (!tenant) {
      return NextResponse.json({ error: "Workspace tenant not found or inactive" }, { status: 404, headers: CORS_HEADERS })
    }

    const body = await request.json().catch(() => ({}))
    const parsed = LoginSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation error", details: parsed.error.format() },
        { status: 400, headers: CORS_HEADERS }
      )
    }

    const { email, password } = parsed.data
    const tenantDb = (await getTenantDb(tenant.slug)) as any

    // Find member by email in this tenant
    const member = await tenantDb.member.findUnique({
      where: {
        tenantId_email: {
          tenantId: tenant.id,
          email,
        }
      }
    })

    if (!member) {
      return NextResponse.json(
        { error: "Email atau password salah" },
        { status: 401, headers: CORS_HEADERS }
      )
    }

    if (member.status !== "active") {
      return NextResponse.json(
        { error: `Akun Anda sedang ${member.status}. Hubungi administrator.` },
        { status: 403, headers: CORS_HEADERS }
      )
    }

    // Verify password
    const isPasswordValid = await verifyMemberPassword(password, member.passwordHash)
    if (!isPasswordValid) {
      return NextResponse.json(
        { error: "Email atau password salah" },
        { status: 401, headers: CORS_HEADERS }
      )
    }

    // Update lastLoginAt
    await tenantDb.member.update({
      where: { id: member.id },
      data: { lastLoginAt: new Date() }
    })

    // Generate Refresh Token & Session
    const refreshToken = generateRefreshTokenString()
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_TTL_DAYS)

    const userAgent = request.headers.get("user-agent") || null

    await tenantDb.memberSession.create({
      data: {
        memberId: member.id,
        tenantId: tenant.id,
        refreshToken,
        userAgent,
        ipAddress: clientIp,
        expiresAt,
      }
    })

    // Sign JWT Access Token
    const { token: accessToken, expiresIn } = signMemberAccessToken({
      sub: member.id,
      email: member.email,
      tenantId: tenant.id,
      tenantSlug: tenant.slug,
      role: member.role,
    })

    return NextResponse.json(
      {
        message: "Login berhasil",
        user: {
          id: member.id,
          email: member.email,
          name: member.name,
          avatar: member.avatar,
          role: member.role,
          status: member.status,
          metadata: member.metadata,
          createdAt: member.createdAt,
          lastLoginAt: member.lastLoginAt,
        },
        accessToken,
        refreshToken,
        expiresIn,
        tokenType: "Bearer",
      },
      { status: 200, headers: CORS_HEADERS }
    )
  } catch (error) {
    console.error("[public-auth/login]", error)
    return NextResponse.json(
      { error: "Gagal melakukan login" },
      { status: 500, headers: CORS_HEADERS }
    )
  }
}
