import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/database"

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const roleSlug = session.user.role

    // If super_admin, return a special flag or wildcard
    if (roleSlug === "super_admin" || roleSlug === "admin") {
      return NextResponse.json({ permissions: ["*"] })
    }

    // Otherwise, fetch all permissions associated with this system role
    const rolePermissions = await db.rolePermission.findMany({
      where: { 
        tenantId: null, // global permissions
        roleId: roleSlug,
        granted: true
      },
      include: {
        permission: true
      }
    })

    const permittedPaths = rolePermissions
      .filter(rp => rp.permission.category === "navigation" || rp.permission.name.startsWith("/"))
      .map(rp => rp.permission.name)

    return NextResponse.json({ permissions: permittedPaths })
  } catch (error) {
    console.error("Error fetching user permissions:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
