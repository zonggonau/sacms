import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db, getTenantDb } from "@/lib/database"
import { hashMemberPassword, signMemberAccessToken, generateRefreshTokenString, REFRESH_TOKEN_TTL_DAYS } from "@/lib/member-auth"
import { rateLimit } from "@/lib/rate-limit"
import { ensureSystemRoles } from "@/lib/permissions-engine"

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
}

export async function OPTIONS() { return new NextResponse(null, { status: 204, headers: CORS_HEADERS }) }

const RegisterSchema = z.object({
  username: z.string().min(2).max(60).trim().optional(),
  email: z.string().email().toLowerCase().trim(),
  password: z.string().min(8, "Password minimal 8 karakter"),
})

export async function POST(request: NextRequest, { params }: { params: Promise<{ tenant: string }> }) {
  try {
    const { tenant: tenantSlug } = await params
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "127.0.0.1"
    const rl = await rateLimit(`auth:register:${tenantSlug}:${ip}`, { limit: 5, windowSeconds: 60 })
    if (!rl.success) return NextResponse.json({ error: "Too many requests." }, { status: 429, headers: CORS_HEADERS })

    const tenant = await db.tenant.findFirst({ where: { OR: [{ slug: tenantSlug }, { id: tenantSlug }] }, select: { id: true, slug: true, status: true } })
    if (!tenant || tenant.status !== "active") return NextResponse.json({ error: "Tenant not found" }, { status: 404, headers: CORS_HEADERS })

    const body = await request.json().catch(() => ({}))
    const parsed = RegisterSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: "Validation failed", details: parsed.error.format() }, { status: 400, headers: CORS_HEADERS })

    const { username, email, password } = parsed.data

    const tenantDb = (await getTenantDb(tenant.slug)) as any

    const existing = await tenantDb.member.findFirst({ where: { tenantId: tenant.id, email } })
    if (existing) return NextResponse.json({ error: "Email is already taken." }, { status: 400, headers: CORS_HEADERS })

    const passwordHash = await hashMemberPassword(password)

    await ensureSystemRoles(tenant.id)

    const member = await tenantDb.member.create({
      data: {
        tenantId: tenant.id,
        email,
        name: username ?? email.split("@")[0],
        passwordHash,
        role: "authenticated",
        status: "active",
        emailVerified: new Date(), // auto-confirm for now; set null to require email confirmation
      },
    })

    const refreshToken = generateRefreshTokenString()
    const sessionExpires = new Date()
    sessionExpires.setDate(sessionExpires.getDate() + REFRESH_TOKEN_TTL_DAYS)
    await tenantDb.memberSession.create({ data: { memberId: member.id, tenantId: tenant.id, refreshToken, userAgent: request.headers.get("user-agent"), ipAddress: ip, expiresAt: sessionExpires } })

    const { token: jwt } = signMemberAccessToken({ sub: member.id, email: member.email, tenantId: tenant.id, tenantSlug: tenant.slug, role: member.role })

    return NextResponse.json({
      jwt,
      refreshToken,
      user: {
        id: member.id,
        documentId: member.id,
        username: member.name,
        email: member.email,
        provider: "local",
        confirmed: !!member.emailVerified,
        blocked: false,
        createdAt: member.createdAt,
        updatedAt: member.updatedAt,
        role: { id: member.role, name: member.role, type: member.role },
      },
    }, { status: 200, headers: CORS_HEADERS })
  } catch (error: any) {
    return NextResponse.json({ error: error.message ?? "Internal server error" }, { status: 500, headers: CORS_HEADERS })
  }
}
