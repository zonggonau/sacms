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

    // Check if role exists and is NOT a system role
    const role = await db.role.findUnique({
      where: { id: roleId }
    })

    if (!role) {
      return NextResponse.json({ error: "Role not found" }, { status: 404 })
    }

    if (role.isSystem || !role.tenantId) {
      return NextResponse.json({ error: "Cannot delete system roles" }, { status: 400 })
    }

    // Ensure the role belongs to this tenant
    if (role.tenantId !== tenant.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Delete the role (Cascade will handle role_permissions)
    await db.role.delete({
      where: { id: roleId }
    })

    // Note: TenantMember uses a string for 'role'. 
    // If a custom role is deleted, users with that role string will lose access 
    // because hasPermission will fail to find the role/permissions.
    // They should be reassigned manually or we could bulk update them to 'viewer' here.

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting tenant role:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
