import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/database"
import { getTenantAccess } from "@/lib/tenant-access"
import { z } from "zod"
import { ensureSystemRoles, invalidatePermissionCache } from "@/lib/permissions-engine"

const CreateRoleSchema = z.object({
  name: z.string().min(1).max(60).trim(),
  slug: z.string().min(1).max(60).toLowerCase().regex(/^[a-z0-9-]+$/, "slug must be lowercase alphanumeric and hyphens"),
  description: z.string().optional(),
})

export async function GET(request: NextRequest, { params }: { params: Promise<{ tenant: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const { tenant: tenantSlug } = await params
    const access = await getTenantAccess(session, tenantSlug)
    if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    await ensureSystemRoles(access.tenantId)

    const roles = await db.memberRole.findMany({
      where: { tenantId: access.tenantId },
      include: { _count: { select: { permissions: true } } },
      orderBy: [{ isSystem: "desc" }, { createdAt: "asc" }],
    })

    // Attach member count per role
    const memberCounts = await db.member.groupBy({ by: ["role"], where: { tenantId: access.tenantId }, _count: true })
    const countMap = Object.fromEntries(memberCounts.map((r) => [r.role, r._count]))

    return NextResponse.json({
      roles: roles.map((r) => ({
        ...r,
        memberCount: countMap[r.slug] ?? 0,
      })),
    })
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
    const parsed = CreateRoleSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: "Validation failed", details: parsed.error.format() }, { status: 400 })

    const { name, slug, description } = parsed.data

    // Block reserved slugs
    if (slug === "public" || slug === "authenticated") {
      return NextResponse.json({ error: `"${slug}" is a reserved system role slug` }, { status: 400 })
    }

    const existing = await db.memberRole.findFirst({ where: { tenantId: access.tenantId, slug } })
    if (existing) return NextResponse.json({ error: "A role with this slug already exists" }, { status: 409 })

    const role = await db.memberRole.create({ data: { tenantId: access.tenantId, name, slug, description } })

    return NextResponse.json({ role }, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message ?? "Internal server error" }, { status: 500 })
  }
}
