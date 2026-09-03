import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/database"
import { getTenantAccess } from "@/lib/tenant-access"
import { z } from "zod"
import { invalidatePermissionCache } from "@/lib/permissions-engine"

const PermissionsSchema = z.object({
  permissions: z.array(z.object({
    contentTypeSlug: z.string().min(1),
    action: z.enum(["find", "findOne", "create", "update", "delete"]),
    granted: z.boolean().default(true),
    conditions: z.record(z.unknown()).optional(),
  })),
})

export async function GET(request: NextRequest, { params }: { params: Promise<{ tenant: string; roleId: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const { tenant: tenantSlug, roleId } = await params
    const access = await getTenantAccess(session, tenantSlug)
    if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const perms = await db.memberRolePermission.findMany({
      where: { memberRoleId: roleId },
      orderBy: [{ contentTypeSlug: "asc" }, { action: "asc" }],
    })

    return NextResponse.json({ permissions: perms })
  } catch (error: any) {
    return NextResponse.json({ error: error.message ?? "Internal server error" }, { status: 500 })
  }
}

/** PUT replaces the entire permission set for a role (idempotent matrix save) */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ tenant: string; roleId: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const { tenant: tenantSlug, roleId } = await params
    const access = await getTenantAccess(session, tenantSlug)
    if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const role = await db.memberRole.findFirst({ where: { id: roleId, tenantId: access.tenantId } })
    if (!role) return NextResponse.json({ error: "Role not found" }, { status: 404 })

    const body = await request.json().catch(() => ({}))
    const parsed = PermissionsSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: "Validation failed", details: parsed.error.format() }, { status: 400 })

    const { permissions } = parsed.data

    // Replace all permissions atomically
    await db.$transaction([
      db.memberRolePermission.deleteMany({ where: { memberRoleId: roleId } }),
      db.memberRolePermission.createMany({
        data: permissions.map((p) => ({
          memberRoleId: roleId,
          contentTypeSlug: p.contentTypeSlug,
          action: p.action,
          granted: p.granted,
          conditions: p.conditions ?? null,
        })),
        skipDuplicates: true,
      }),
    ])

    await invalidatePermissionCache(access.tenantId, role.slug)

    return NextResponse.json({ ok: true, count: permissions.length })
  } catch (error: any) {
    return NextResponse.json({ error: error.message ?? "Internal server error" }, { status: 500 })
  }
}
