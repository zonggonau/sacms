import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/database"

// DELETE /api/tenant/[tenant]/rbac/roles/[roleId] - Delete custom role
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ tenant: string, roleId: string }> }
) {
  try {
    const { tenant: tenantSlug, roleId } = await params
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const tenant = await db.tenant.findFirst({
      where: {
        OR: [{ slug: tenantSlug }, { id: tenantSlug }],
      },
    })

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 })
    }

    // Check if user is owner or admin of this tenant
    const membership = await db.tenantMember.findFirst({
      where: {
        tenantId: tenant.id,
        userId: session.user.id,
        role: { in: ["owner", "admin"] },
      },
    })

    if (!membership && session.user.role !== "super_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const role = await db.tenantRole.findFirst({
      where: { id: roleId, tenantId: tenant.id }
    })

    if (!role) {
      return NextResponse.json({ error: "Role not found" }, { status: 404 })
    }

    const membersWithRole = await db.tenantMember.count({
      where: { tenantId: tenant.id, role: role.slug },
    })
    if (membersWithRole > 0) {
      return NextResponse.json(
        { error: `Cannot delete role. It is assigned to ${membersWithRole} members.` },
        { status: 409 }
      )
    }

    await db.$transaction(async (tx) => {
      await tx.rolePermission.deleteMany({
        where: { tenantId: tenant.id, roleId: role.slug },
      })
      await tx.tenantRole.delete({
        where: { id: roleId }
      })
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting tenant role:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
