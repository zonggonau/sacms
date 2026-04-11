import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions, hashPassword } from "@/lib/auth"
import { db } from "@/lib/database"
import { validateBody } from "@/lib/validate"
import { z } from "zod/v4"

const updateMemberSchema = z.object({
  role: z.enum(["owner", "admin", "editor", "viewer"]).optional(),
  password: z.string().min(8).optional(), // For manual password reset/edit
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ tenant: string; memberId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { tenant: tenantSlug, memberId } = await params
    const tenant = await db.tenant.findFirst({ where: { OR: [{ slug: tenantSlug }, { id: tenantSlug }] } })
    if (!tenant) return NextResponse.json({ error: "Tenant not found" }, { status: 404 })

    // Check if requester is admin/owner
    const requester = await db.tenantMember.findFirst({
      where: { tenantId: tenant.id, userId: session.user.id, role: { in: ["owner", "admin"] } },
    })
    const isSuperAdmin = session.user.role === "super_admin"
    if (!requester && !isSuperAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const result = await validateBody(request, updateMemberSchema)
    if ("error" in result) return result.error
    const { role, password } = result.data

    // Find the target member
    const member = await db.tenantMember.findUnique({
      where: { id: memberId },
      include: { user: true }
    })

    if (!member || member.tenantId !== tenant.id) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 })
    }

    // Update Role
    if (role) {
      // Prevent removing the last owner
      if (member.role === "owner" && role !== "owner") {
        const ownerCount = await db.tenantMember.count({
          where: { tenantId: tenant.id, role: "owner" }
        })
        if (ownerCount <= 1) {
          return NextResponse.json({ error: "Cannot change the only owner's role" }, { status: 400 })
        }
      }
      
      await db.tenantMember.update({
        where: { id: memberId },
        data: { role }
      })
    }

    // Update Password
    if (password) {
      const hashedPassword = await hashPassword(password)
      await db.user.update({
        where: { id: member.userId },
        data: { password: hashedPassword }
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error updating member:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ tenant: string; memberId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { tenant: tenantSlug, memberId } = await params
    const tenant = await db.tenant.findFirst({ where: { OR: [{ slug: tenantSlug }, { id: tenantSlug }] } })
    if (!tenant) return NextResponse.json({ error: "Tenant not found" }, { status: 404 })

    const requester = await db.tenantMember.findFirst({
      where: { tenantId: tenant.id, userId: session.user.id, role: { in: ["owner", "admin"] } },
    })
    const isSuperAdmin = session.user.role === "super_admin"
    if (!requester && !isSuperAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const member = await db.tenantMember.findUnique({ where: { id: memberId } })
    if (!member || member.tenantId !== tenant.id) return NextResponse.json({ error: "Member not found" }, { status: 404 })

    // Prevent self-removal
    if (member.userId === session.user.id) return NextResponse.json({ error: "You cannot remove yourself" }, { status: 400 })

    // Prevent removing the last owner
    if (member.role === "owner") {
      const ownerCount = await db.tenantMember.count({ where: { tenantId: tenant.id, role: "owner" } })
      if (ownerCount <= 1) return NextResponse.json({ error: "Cannot remove the only owner" }, { status: 400 })
    }

    await db.tenantMember.delete({ where: { id: memberId } })
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
