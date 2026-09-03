import { NextResponse } from "next/server"
import { db } from "@/lib/database"
import { z } from "zod/v4"
import { withAdminAuth, apiError, readJson } from "@/lib/api/route-helpers"

/** Roles a platform admin may assign. `super_admin` is added only for a super_admin actor. */
const ADMIN_ASSIGNABLE_ROLES = ["owner", "user", "admin", "employee", "karyawan"] as const
const ALL_ASSIGNABLE_ROLES = [...ADMIN_ASSIGNABLE_ROLES, "super_admin"] as const

const updateUserSchema = z.object({
  name: z.string().min(2).max(100).optional().nullable(),
  role: z.enum(ALL_ASSIGNABLE_ROLES).optional(),
  email: z.string().email().optional(),
  password: z.string().min(8).max(128).optional().nullable(),
})

export const GET = withAdminAuth(
  async (_request, context) => {
    const { userId } = await context.params
    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        image: true,
        createdAt: true,
        tenants: {
          include: {
            tenant: true
          }
        }
      }
    })

    if (!user) return apiError("not_found", { message: "User not found" })
    return NextResponse.json({ user })
  },
  { allowRoles: ["admin"] },
)

export const PATCH = withAdminAuth(
  async (request, context, { session }) => {
    const { userId } = await context.params
    const isSuperAdmin = session.user.role === "super_admin"

    const target = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true },
    })
    if (!target) return apiError("not_found", { message: "User not found" })

    // Only a super_admin may modify a super_admin account at all.
    if (target.role === "super_admin" && !isSuperAdmin) {
      return apiError("forbidden", { message: "Only a super admin can modify a super admin account" })
    }

    const body = await readJson(request, updateUserSchema)
    if (!body.ok) return body.response

    const updateData: Record<string, unknown> = { ...body.data }

    // Role changes are the escalation surface — gate them hard.
    if (updateData.role !== undefined) {
      if (updateData.role === target.role) {
        delete updateData.role
      } else if (userId === session.user.id) {
        return apiError("forbidden", { message: "You cannot change your own role" })
      } else if (updateData.role === "super_admin" && !isSuperAdmin) {
        return apiError("forbidden", { message: "Only a super admin can grant the super admin role" })
      } else if (!isSuperAdmin && !ADMIN_ASSIGNABLE_ROLES.includes(updateData.role as (typeof ADMIN_ASSIGNABLE_ROLES)[number])) {
        return apiError("forbidden", { message: "You cannot assign that role" })
      }
    }

    if (updateData.password) {
      const { hashPassword } = await import("@/lib/auth")
      updateData.password = await hashPassword(updateData.password as string)
    } else {
      delete updateData.password
    }

    if (updateData.email) {
      const clash = await db.user.findUnique({ where: { email: updateData.email as string } })
      if (clash && clash.id !== userId) {
        return apiError("conflict", { message: "That email is already in use" })
      }
    }

    const user = await db.user.update({ where: { id: userId }, data: updateData })
    return NextResponse.json({ user })
  },
  { allowRoles: ["admin"] },
)

export const DELETE = withAdminAuth(
  async (request, context, { session }) => {
    const { userId } = await context.params
    const isSuperAdmin = session.user.role === "super_admin"

    if (session.user.id === userId) {
      return apiError("validation", { message: "You cannot delete yourself" })
    }

    const targetUser = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, role: true },
    })

    if (!targetUser) return apiError("not_found", { message: "User not found" })

    // A super_admin may only be deleted by a super_admin, and never if it's the last one.
    if (targetUser.role === "super_admin") {
      if (!isSuperAdmin) {
        return apiError("forbidden", { message: "Only a super admin can delete a super admin account" })
      }
      const superAdminCount = await db.user.count({ where: { role: "super_admin" } })
      if (superAdminCount <= 1) {
        return apiError("validation", { message: "Cannot delete the last super admin" })
      }
    }

    // Check email confirmation if provided
    let confirmEmail: string | null = null
    try {
      const body = await request.json()
      confirmEmail = body?.confirmEmail || null
    } catch {
      const url = new URL(request.url)
      confirmEmail = url.searchParams.get("confirmEmail")
    }

    if (confirmEmail && confirmEmail.trim().toLowerCase() !== targetUser.email.trim().toLowerCase()) {
      return apiError("validation", { message: "Konfirmasi email tidak sesuai. Penghapusan dibatalkan." })
    }

    // Delete all related records in transaction to prevent foreign key constraint violations
    await db.$transaction(async (tx) => {
      const userSubs = await tx.subscription.findMany({
        where: { userId },
        select: { id: true },
      })
      const subIds = userSubs.map((s) => s.id)

      if (subIds.length > 0) {
        await tx.paymentTransaction.deleteMany({ where: { subscriptionId: { in: subIds } } })
        await tx.invoice.deleteMany({ where: { subscriptionId: { in: subIds } } })
        await tx.subscription.deleteMany({ where: { id: { in: subIds } } })
      }

      await tx.customPlanOverride.deleteMany({ where: { userId } })
      await tx.aiQuotaLedger.deleteMany({ where: { userId } })
      await tx.account.deleteMany({ where: { userId } })
      await tx.session.deleteMany({ where: { userId } })
      await tx.tenantMember.deleteMany({ where: { userId } })
      await tx.user.delete({ where: { id: userId } })
    })

    return NextResponse.json({ success: true })
  },
  { allowRoles: ["admin"] },
)
