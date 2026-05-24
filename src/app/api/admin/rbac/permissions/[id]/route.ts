import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/database"
import { validateBody } from "@/lib/validate"
import { updatePermissionSchema } from "@/lib/validations"

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (session.user.role !== "super_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { id } = params
    const result = await validateBody(request, updatePermissionSchema)
    if ("error" in result) return result.error
    
    const data = result.data

    if (data.name) {
      const existing = await db.permission.findUnique({ where: { name: data.name } })
      if (existing && existing.id !== id) {
        return NextResponse.json({ error: "Permission with this name already exists" }, { status: 400 })
      }
    }

    const permission = await db.permission.update({
      where: { id },
      data,
    })

    return NextResponse.json({ permission })
  } catch (error) {
    console.error("Error updating permission:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (session.user.role !== "super_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { id } = params

    // Check if it's assigned to any roles
    const assignments = await db.rolePermission.count({
      where: { permissionId: id }
    })

    if (assignments > 0) {
      // Cascade delete might be enabled, but if not we should delete role permissions first
      await db.rolePermission.deleteMany({
        where: { permissionId: id }
      })
    }

    await db.permission.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting permission:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
