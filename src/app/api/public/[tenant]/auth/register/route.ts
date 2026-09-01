import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db, getTenantDb } from "@/lib/database"
import { 
  hashMemberPassword, 
  signMemberAccessToken, 
  generateRefreshTokenString, 
  REFRESH_TOKEN_TTL_DAYS 
} from "@/lib/member-auth"
import { rateLimit } from "@/lib/rate-limit"

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-api-key",
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

const RegisterSchema = z.object({
  email: z.string().email("Format email tidak valid").toLowerCase().trim(),
  password: z.string().min(6, "Password minimal 6 karakter"),
  name: z.string().optional(),
  avatar: z.string().url().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
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

    // Rate limiting: 5 registrations per minute per IP
    const forwardedFor = request.headers.get("x-forwarded-for")
    const clientIp = forwardedFor ? forwardedFor.split(",")[0].trim() : "127.0.0.1"
    const rl = await rateLimit(`auth:register:${tenantSlug}:${clientIp}`, { limit: 5, windowSeconds: 60 })
    if (!rl.success) {
      return NextResponse.json(
        { error: "Terlalu banyak percobaan registrasi. Silakan tunggu 1 menit." },
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
    const parsed = RegisterSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation error", details: parsed.error.format() },
        { status: 400, headers: CORS_HEADERS }
      )
    }

    const { email, password, name, avatar, metadata } = parsed.data
    const tenantDb = (await getTenantDb(tenant.slug)) as any

    // Check if email already registered in this tenant
    const existing = await tenantDb.member.findUnique({
      where: {
        tenantId_email: {
          tenantId: tenant.id,
          email,
        }
      }
    })

    if (existing) {
      return NextResponse.json(
        { error: "Email sudah terdaftar pada workspace ini" },
        { status: 409, headers: CORS_HEADERS }
      )
    }

    // Hash password with bcrypt
    const passwordHash = await hashMemberPassword(password)

    // Create member
    const member = await tenantDb.member.create({
      data: {
        tenantId: tenant.id,
        email,
        passwordHash,
        name: name || null,
        avatar: avatar || null,
        role: "member",
        status: "active",
        metadata: metadata || {},
        lastLoginAt: new Date(),
      }
    })

    // Generate Refresh Token & Session
    const refreshToken = generateRefreshTokenString()
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_TTL_DAYS)

    const userAgent = request.headers.get("user-agent") || null
    const ipAddress = clientIp || null

    await tenantDb.memberSession.create({
      data: {
        memberId: member.id,
        tenantId: tenant.id,
        refreshToken,
        userAgent,
        ipAddress,
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
        message: "Registrasi berhasil",
        user: {
          id: member.id,
          email: member.email,
          name: member.name,
          avatar: member.avatar,
          role: member.role,
          status: member.status,
          metadata: member.metadata,
          createdAt: member.createdAt,
        },
        accessToken,
        refreshToken,
        expiresIn,
        tokenType: "Bearer",
      },
      { status: 201, headers: CORS_HEADERS }
    )
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Gagal melakukan registrasi" },
      { status: 500, headers: CORS_HEADERS }
    )
  }
}
