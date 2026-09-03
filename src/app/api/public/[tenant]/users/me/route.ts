import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getTenantDb } from "@/lib/database"
import { authCorsPreflight } from "@/lib/member-auth-cors"
import { resolveMemberRequest } from "@/lib/member-request"

export async function OPTIONS(
  request: NextRequest,
  { params }: { params: Promise<{ tenant: string }> },
) {
  const { tenant } = await params
  return authCorsPreflight(request, tenant)
}

const UpdateSchema = z.object({
  name: z.string().max(120).optional(),
  avatar: z.string().url().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

export async function GET(request: NextRequest, { params }: { params: Promise<{ tenant: string }> }) {
  try {
    const { tenant: tenantSlug } = await params
    const auth = await resolveMemberRequest(request, tenantSlug)
    if (!auth.ok) return auth.response

    const tenantDb = (await getTenantDb(auth.tenant.slug)) as any
    const member = await tenantDb.member.findUnique({
      where: { id: auth.payload.sub },
      select: { id: true, email: true, name: true, avatar: true, role: true, status: true, metadata: true, createdAt: true, updatedAt: true, lastLoginAt: true, emailVerified: true },
    })
    if (!member || member.status !== "active") {
      return NextResponse.json({ error: "Member not found or inactive" }, { status: 404, headers: auth.cors })
    }

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
    }, { status: 200, headers: auth.cors })
  } catch (error) {
    console.error("[public-users/me]", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ tenant: string }> }) {
  try {
    const { tenant: tenantSlug } = await params
    const auth = await resolveMemberRequest(request, tenantSlug)
    if (!auth.ok) return auth.response

    const body = await request.json().catch(() => ({}))
    const parsed = UpdateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation error", details: parsed.error.format() }, { status: 400, headers: auth.cors })
    }

    const tenantDb = (await getTenantDb(auth.tenant.slug)) as any
    const existing = await tenantDb.member.findUnique({ where: { id: auth.payload.sub } })
    if (!existing || existing.status !== "active") {
      return NextResponse.json({ error: "Member not found or inactive" }, { status: 404, headers: auth.cors })
    }

    const data: Record<string, unknown> = {}
    if (parsed.data.name !== undefined) data.name = parsed.data.name
    if (parsed.data.avatar !== undefined) data.avatar = parsed.data.avatar
    if (parsed.data.metadata !== undefined) {
      data.metadata = { ...((existing.metadata as Record<string, unknown>) || {}), ...parsed.data.metadata }
    }

    const updated = await tenantDb.member.update({
      where: { id: auth.payload.sub },
      data,
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
    }, { status: 200, headers: auth.cors })
  } catch (error) {
    console.error("[public-users/me]", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
