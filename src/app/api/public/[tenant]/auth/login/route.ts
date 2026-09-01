import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db, getTenantDb } from "@/lib/database"
import { 
  verifyMemberPassword, 
  signMemberAccessToken, 
  generateRefreshTokenString, 
  REFRESH_TOKEN_TTL_DAYS 
} from "@/lib/member-auth"
import { checkRateLimit } from "@/lib/rate-limit"

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-api-key",
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

const LoginSchema = z.object({
  email: z.string().email("Format email tidak valid").toLowerCase().trim(),
  password: z.string().min(1, "Password wajib diisi"),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tenant: string }> }
) {
  try {
    const { tenant: tenantSlug } = await params
    if (!tenantSlug) {
      return NextResponse.json({ error: "Tenant identifier required" }, { status: 400, headers: CORS_HEADERS })
    }

    // Rate limiting: 10 attempts per minute per IP
    const forwardedFor = request.headers.get("x-forwarded-for")
    const clientIp = forwardedFor ? forwardedFor.split(",")[0].trim() : "127.0.0.1"
    const rateLimit = await checkRateLimit(`auth:login:${tenantSlug}:${clientIp}`, 10, 60)
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Terlalu banyak percobaan login. Silakan tunggu 1 menit." },
        { status: 429, headers: CORS_HEADERS }
      )
    }

    // Resolve tenant
    const tenant = await db.tenant.findFirst({
      where: {
        OR: [{ slug: tenantSlug }, { id: tenantSlug }]
      },
      select: { id: true, slug: true, name: true, status: true }
    })

    if (!tenant || tenant.status !== "active") {
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
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Gagal melakukan login" },
      { status: 500, headers: CORS_HEADERS }
    )
  }
}
