import { NextResponse } from "next/server"
import { db } from "@/lib/database"
import { validateBody } from "@/lib/validate"
import { z } from "zod/v4"
import { withAdminAuth, apiError } from "@/lib/api/route-helpers"

const updateUserSchema = z.object({
  name: z.string().min(2).max(100).optional().nullable(),
  role: z.string().optional(),
  email: z.string().email().optional(),
  password: z.string().min(6).optional().nullable(),
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
  async (request, context) => {
    const { userId } = await context.params
    const result = await validateBody(request, updateUserSchema)
    if ("error" in result) return result.error

    const updateData: any = { ...result.data }
    
    // Hash password if it is provided
    if (updateData.password) {
      const { hashPassword } = await import("@/lib/auth")
      updateData.password = await hashPassword(updateData.password)
    } else {
      delete updateData.password // ensure we don't accidentally set it to null if empty
    }

    const user = await db.user.update({ where: { id: userId }, data: updateData })
    return NextResponse.json({ user })
  },
  { allowRoles: ["admin"] },
)

export const DELETE = withAdminAuth(
  async (request, context, { session }) => {
    const { userId } = await context.params

    if (session.user.id === userId) {
      return apiError("validation", { message: "You cannot delete yourself" })
    }

    const targetUser = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true },
    })

    if (!targetUser) return apiError("not_found", { message: "User not found" })

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
      // 1. Find all subscriptions belonging to this user
      const userSubs = await tx.subscription.findMany({
        where: { userId },
        select: { id: true },
      })
      const subIds = userSubs.map((s) => s.id)

      if (subIds.length > 0) {
        // Delete payment transactions referencing these subscriptions
        await tx.paymentTransaction.deleteMany({
          where: { subscriptionId: { in: subIds } },
        })

        // Delete invoices referencing these subscriptions
        await tx.invoice.deleteMany({
          where: { subscriptionId: { in: subIds } },
        })

        // Delete subscriptions
        await tx.subscription.deleteMany({
          where: { id: { in: subIds } },
        })
      }

      // 2. Delete custom plan overrides
      await tx.customPlanOverride.deleteMany({
        where: { userId },
      })

      // 3. Delete AI Quota ledgers
      await tx.aiQuotaLedger.deleteMany({
        where: { userId },
      })

      // 4. Delete NextAuth accounts & sessions
      await tx.account.deleteMany({
        where: { userId },
      })
      await tx.session.deleteMany({
        where: { userId },
      })

      // 5. Delete tenant memberships
      await tx.tenantMember.deleteMany({
        where: { userId },
      })

      // 6. Delete user
      await tx.user.delete({
        where: { id: userId },
      })
    })

    return NextResponse.json({ success: true })
  },
  { allowRoles: ["admin"] },
)
