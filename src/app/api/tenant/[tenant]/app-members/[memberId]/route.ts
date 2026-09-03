import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/database"
import { getTenantAccess } from "@/lib/tenant-access"
import { z } from "zod"
import { hashMemberPassword } from "@/lib/member-auth"

const UpdateSchema = z.object({
  name: z.string().min(1).optional(),
  role: z.string().optional(),
  status: z.enum(["active", "suspended", "pending_verification"]).optional(),
  metadata: z.record(z.unknown()).optional(),
  password: z.string().min(8).optional(),
})

export async function GET(request: NextRequest, { params }: { params: Promise<{ tenant: string; memberId: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const { tenant: tenantSlug, memberId } = await params
    const access = await getTenantAccess(session, tenantSlug)
    if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const member = await db.member.findFirst({
      where: { id: memberId, tenantId: access.tenantId },
      select: { id: true, email: true, name: true, avatar: true, role: true, status: true, metadata: true, createdAt: true, updatedAt: true, lastLoginAt: true, emailVerified: true },
    })
    if (!member) return NextResponse.json({ error: "Member not found" }, { status: 404 })

    return NextResponse.json({ member })
  } catch (error: any) {
    return NextResponse.json({ error: error.message ?? "Internal server error" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ tenant: string; memberId: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const { tenant: tenantSlug, memberId } = await params
    const access = await getTenantAccess(session, tenantSlug)
    if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const member = await db.member.findFirst({ where: { id: memberId, tenantId: access.tenantId } })
    if (!member) return NextResponse.json({ error: "Member not found" }, { status: 404 })

    const body = await request.json().catch(() => ({}))
    const parsed = UpdateSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: "Validation failed", details: parsed.error.format() }, { status: 400 })

    const { password, ...rest } = parsed.data
    const data: any = { ...rest }
    if (password) data.passwordHash = await hashMemberPassword(password)

    const updated = await db.member.update({
      where: { id: memberId },
      data,
      select: { id: true, email: true, name: true, avatar: true, role: true, status: true, metadata: true, createdAt: true, updatedAt: true },
    })

    return NextResponse.json({ member: updated })
  } catch (error: any) {
    return NextResponse.json({ error: error.message ?? "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ tenant: string; memberId: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const { tenant: tenantSlug, memberId } = await params
    const access = await getTenantAccess(session, tenantSlug)
    if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const member = await db.member.findFirst({ where: { id: memberId, tenantId: access.tenantId } })
    if (!member) return NextResponse.json({ error: "Member not found" }, { status: 404 })

    await db.member.delete({ where: { id: memberId } })
    return NextResponse.json({ ok: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message ?? "Internal server error" }, { status: 500 })
  }
}
