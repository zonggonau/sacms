import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/database"
import { getTenantAccess } from "@/lib/tenant-access"
import { z } from "zod"
import { invalidatePermissionCache } from "@/lib/permissions-engine"

const UpdateSchema = z.object({
  name: z.string().min(1).max(60).trim().optional(),
  description: z.string().optional(),
})

export async function GET(request: NextRequest, { params }: { params: Promise<{ tenant: string; roleId: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const { tenant: tenantSlug, roleId } = await params
    const access = await getTenantAccess(session, tenantSlug)
    if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const role = await db.memberRole.findFirst({
      where: { id: roleId, tenantId: access.tenantId },
      include: { permissions: { orderBy: [{ contentTypeSlug: "asc" }, { action: "asc" }] } },
    })
    if (!role) return NextResponse.json({ error: "Role not found" }, { status: 404 })

    return NextResponse.json({ role })
  } catch (error: any) {
    return NextResponse.json({ error: error.message ?? "Internal server error" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ tenant: string; roleId: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const { tenant: tenantSlug, roleId } = await params
    const access = await getTenantAccess(session, tenantSlug)
    if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const role = await db.memberRole.findFirst({ where: { id: roleId, tenantId: access.tenantId } })
    if (!role) return NextResponse.json({ error: "Role not found" }, { status: 404 })
    if (role.isSystem) return NextResponse.json({ error: "Cannot modify system roles" }, { status: 400 })

    const body = await request.json().catch(() => ({}))
    const parsed = UpdateSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: "Validation failed", details: parsed.error.format() }, { status: 400 })

    const updated = await db.memberRole.update({ where: { id: roleId }, data: parsed.data })
    await invalidatePermissionCache(access.tenantId, role.slug)

    return NextResponse.json({ role: updated })
  } catch (error: any) {
    return NextResponse.json({ error: error.message ?? "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ tenant: string; roleId: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const { tenant: tenantSlug, roleId } = await params
    const access = await getTenantAccess(session, tenantSlug)
    if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const role = await db.memberRole.findFirst({ where: { id: roleId, tenantId: access.tenantId } })
    if (!role) return NextResponse.json({ error: "Role not found" }, { status: 404 })
    if (role.isSystem) return NextResponse.json({ error: "Cannot delete system roles" }, { status: 400 })

    await db.memberRole.delete({ where: { id: roleId } })
    await invalidatePermissionCache(access.tenantId, role.slug)

    return NextResponse.json({ ok: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message ?? "Internal server error" }, { status: 500 })
  }
}
