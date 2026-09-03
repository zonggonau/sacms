import { NextRequest, NextResponse } from "next/server"
import { verifyMemberAccessToken } from "@/lib/member-auth"
import { db, getTenantDb } from "@/lib/database"

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
}

export async function OPTIONS() { return new NextResponse(null, { status: 204, headers: CORS_HEADERS }) }

function unauthorized() {
  return NextResponse.json({ error: "Missing or invalid authorization token" }, { status: 401, headers: CORS_HEADERS })
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ tenant: string }> }) {
  try {
    const { tenant: tenantSlug } = await params
    const authHeader = request.headers.get("authorization") ?? ""
    if (!authHeader.startsWith("Bearer ")) return unauthorized()

    const payload = verifyMemberAccessToken(authHeader.substring(7).trim())
    if (!payload) return unauthorized()

    const tenant = await db.tenant.findFirst({ where: { OR: [{ slug: tenantSlug }, { id: tenantSlug }] }, select: { id: true, slug: true } })
    if (!tenant || payload.tenantId !== tenant.id) return unauthorized()

    const tenantDb = (await getTenantDb(tenant.slug)) as any
    const member = await tenantDb.member.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, name: true, avatar: true, role: true, status: true, metadata: true, createdAt: true, updatedAt: true, lastLoginAt: true, emailVerified: true },
    })
    if (!member || member.status !== "active") return unauthorized()

    return NextResponse.json({
      id: member.id,
      documentId: member.id,
      username: member.name ?? member.email.split("@")[0],
      email: member.email,
      provider: "local",
      confirmed: !!member.emailVerified,
      blocked: member.status === "suspended",
      avatar: member.avatar,
      metadata: member.metadata,
      createdAt: member.createdAt,
      updatedAt: member.updatedAt,
      lastLoginAt: member.lastLoginAt,
      role: { id: member.role, name: member.role, type: member.role },
    }, { status: 200, headers: CORS_HEADERS })
  } catch (error: any) {
    return NextResponse.json({ error: error.message ?? "Internal server error" }, { status: 500, headers: CORS_HEADERS })
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ tenant: string }> }) {
  try {
    const { tenant: tenantSlug } = await params
    const authHeader = request.headers.get("authorization") ?? ""
    if (!authHeader.startsWith("Bearer ")) return unauthorized()

    const payload = verifyMemberAccessToken(authHeader.substring(7).trim())
    if (!payload) return unauthorized()

    const tenant = await db.tenant.findFirst({ where: { OR: [{ slug: tenantSlug }, { id: tenantSlug }] }, select: { id: true, slug: true } })
    if (!tenant || payload.tenantId !== tenant.id) return unauthorized()

    const body = await request.json().catch(() => ({}))
    const { name, avatar, metadata } = body

    const tenantDb = (await getTenantDb(tenant.slug)) as any
    const updated = await tenantDb.member.update({
      where: { id: payload.sub },
      data: { ...(name && { name }), ...(avatar && { avatar }), ...(metadata && { metadata }) },
      select: { id: true, email: true, name: true, avatar: true, role: true, status: true, metadata: true, createdAt: true, updatedAt: true },
    })

    return NextResponse.json({
      id: updated.id,
      documentId: updated.id,
      username: updated.name ?? updated.email.split("@")[0],
      email: updated.email,
      avatar: updated.avatar,
      metadata: updated.metadata,
      role: { id: updated.role, name: updated.role, type: updated.role },
    }, { status: 200, headers: CORS_HEADERS })
  } catch (error: any) {
    return NextResponse.json({ error: error.message ?? "Internal server error" }, { status: 500, headers: CORS_HEADERS })
  }
}
