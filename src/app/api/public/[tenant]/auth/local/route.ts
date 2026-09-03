import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db, getTenantDb } from "@/lib/database"
import {
  verifyMemberPassword,
  signMemberAccessToken,
  generateRefreshTokenString,
  REFRESH_TOKEN_TTL_DAYS,
} from "@/lib/member-auth"
import { rateLimit } from "@/lib/rate-limit"

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

const LocalLoginSchema = z.object({
  identifier: z.string().min(1, "identifier (email) is required"),
  password: z.string().min(1, "password is required"),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tenant: string }> }
) {
  try {
    const { tenant: tenantSlug } = await params

    const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "127.0.0.1"
    const rl = await rateLimit(`auth:local:${tenantSlug}:${ip}`, { limit: 10, windowSeconds: 60 })
    if (!rl.success) {
      return NextResponse.json({ error: "Too many login attempts. Please wait 1 minute." }, { status: 429, headers: CORS_HEADERS })
    }

    const tenant = await db.tenant.findFirst({
      where: { OR: [{ slug: tenantSlug }, { id: tenantSlug }] },
      select: { id: true, slug: true, status: true },
    })
    if (!tenant || tenant.status !== "active") {
      return NextResponse.json({ error: "Tenant not found or inactive" }, { status: 404, headers: CORS_HEADERS })
    }

    const body = await request.json().catch(() => ({}))
    const parsed = LocalLoginSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed", details: parsed.error.format() }, { status: 400, headers: CORS_HEADERS })
    }

    const { identifier, password } = parsed.data
    const email = identifier.toLowerCase().trim()

    // Members + MemberSessions are co-located with tenant content
    // (shared pool -> master db; enterprise -> dedicated db).
    const tenantDb = (await getTenantDb(tenant.slug)) as any

    const member = await tenantDb.member.findFirst({ where: { tenantId: tenant.id, email } })
    if (!member) {
      return NextResponse.json({ error: "Invalid identifier or password" }, { status: 400, headers: CORS_HEADERS })
    }

    if (member.status !== "active") {
      return NextResponse.json({ error: `Account is ${member.status}. Contact administrator.` }, { status: 403, headers: CORS_HEADERS })
    }

    const valid = await verifyMemberPassword(password, member.passwordHash)
    if (!valid) {
      return NextResponse.json({ error: "Invalid identifier or password" }, { status: 400, headers: CORS_HEADERS })
    }

    await tenantDb.member.update({ where: { id: member.id }, data: { lastLoginAt: new Date() } })

    const refreshToken = generateRefreshTokenString()
    const sessionExpires = new Date()
    sessionExpires.setDate(sessionExpires.getDate() + REFRESH_TOKEN_TTL_DAYS)

    await tenantDb.memberSession.create({
      data: { memberId: member.id, tenantId: tenant.id, refreshToken, userAgent: request.headers.get("user-agent"), ipAddress: ip, expiresAt: sessionExpires },
    })

    const { token: jwt } = signMemberAccessToken({ sub: member.id, email: member.email, tenantId: tenant.id, tenantSlug: tenant.slug, role: member.role })

    return NextResponse.json({
      jwt,
      refreshToken,
      user: {
        id: member.id,
        documentId: member.id,
        username: member.name ?? member.email.split("@")[0],
        email: member.email,
        provider: "local",
        confirmed: !!member.emailVerified,
        blocked: member.status === "suspended",
        createdAt: member.createdAt,
        updatedAt: member.updatedAt,
        role: { id: member.role, name: member.role, type: member.role },
      },
    }, { status: 200, headers: CORS_HEADERS })
  } catch (error: any) {
    return NextResponse.json({ error: error.message ?? "Internal server error" }, { status: 500, headers: CORS_HEADERS })
  }
}
