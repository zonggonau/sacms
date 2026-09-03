import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/database"
import { getTenantAccess } from "@/lib/tenant-access"
import { z } from "zod"
import { hashMemberPassword } from "@/lib/member-auth"

const CreateMemberSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  name: z.string().min(1).optional(),
  password: z.string().min(8),
  role: z.string().default("authenticated"),
  status: z.enum(["active", "suspended", "pending_verification"]).default("active"),
  metadata: z.record(z.unknown()).optional(),
})

export async function GET(request: NextRequest, { params }: { params: Promise<{ tenant: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const { tenant: tenantSlug } = await params
    const access = await getTenantAccess(session, tenantSlug)
    if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const url = new URL(request.url)
    const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1"))
    const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get("pageSize") ?? "25")))
    const search = url.searchParams.get("search") ?? ""
    const role = url.searchParams.get("role") ?? ""
    const status = url.searchParams.get("status") ?? ""

    const where: any = { tenantId: access.tenantId }
    if (search) where.OR = [{ email: { contains: search, mode: "insensitive" } }, { name: { contains: search, mode: "insensitive" } }]
    if (role) where.role = role
    if (status) where.status = status

    const [members, total] = await Promise.all([
      db.member.findMany({
        where,
        select: { id: true, email: true, name: true, avatar: true, role: true, status: true, metadata: true, createdAt: true, updatedAt: true, lastLoginAt: true, emailVerified: true },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.member.count({ where }),
    ])

    return NextResponse.json({
      members,
      pagination: { page, pageSize, total, pageCount: Math.ceil(total / pageSize) },
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message ?? "Internal server error" }, { status: 500 })
  }
}

const PolicySchema = z.object({
  allowMemberRegistration: z.boolean().optional(),
  requireMemberEmailVerification: z.boolean().optional(),
})

/** PATCH — update the workspace's headless member-auth policy. */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ tenant: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const { tenant: tenantSlug } = await params
    const access = await getTenantAccess(session, tenantSlug)
    if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const body = await request.json().catch(() => ({}))
    const parsed = PolicySchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: "Validation failed", details: parsed.error.format() }, { status: 400 })

    const data: Record<string, boolean> = {}
    if (parsed.data.allowMemberRegistration !== undefined) data.allowMemberRegistration = parsed.data.allowMemberRegistration
    if (parsed.data.requireMemberEmailVerification !== undefined) data.requireMemberEmailVerification = parsed.data.requireMemberEmailVerification

    const tenant = await db.tenant.update({
      where: { id: access.tenantId },
      data,
      select: { allowMemberRegistration: true, requireMemberEmailVerification: true },
    })

    return NextResponse.json({ policy: tenant })
  } catch (error: any) {
    return NextResponse.json({ error: error.message ?? "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ tenant: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const { tenant: tenantSlug } = await params
    const access = await getTenantAccess(session, tenantSlug)
    if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const body = await request.json().catch(() => ({}))
    const parsed = CreateMemberSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: "Validation failed", details: parsed.error.format() }, { status: 400 })

    const { email, name, password, role, status, metadata } = parsed.data

    const existing = await db.member.findFirst({ where: { tenantId: access.tenantId, email } })
    if (existing) return NextResponse.json({ error: "A member with this email already exists" }, { status: 409 })

    const passwordHash = await hashMemberPassword(password)
    const member = await db.member.create({
      data: { tenantId: access.tenantId, email, name, passwordHash, role, status, metadata },
      select: { id: true, email: true, name: true, avatar: true, role: true, status: true, metadata: true, createdAt: true },
    })

    return NextResponse.json({ member }, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message ?? "Internal server error" }, { status: 500 })
  }
}
