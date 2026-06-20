"use server"

import { getServerSession } from "next-auth"
import { authOptions, hashPassword } from "@/lib/auth"
import { db, getTenantDb } from "@/lib/database"
import { getTenantAccess } from "@/lib/tenant-access"
import { revalidatePath } from "next/cache"
import { z } from "zod/v4"

const createMemberSchema = z.object({
  email: z.string().email(),
  role: z.string().default("viewer"),
  name: z.string().optional(),
  password: z.string().min(8).optional(),
  customPermissions: z.array(z.string()).optional(),
})

const updateMemberSchema = z.object({
  role: z.string().optional(),
  password: z.string().min(8).optional(),
})

export async function getTenantUsersAction(tenantSlug: string) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return { error: "Unauthorized" }

    const access = await getTenantAccess(session, tenantSlug)
    if (!access) return { error: "Forbidden" }

    const tenantDb = await getTenantDb(tenantSlug)

    const members = await tenantDb.tenantMember.findMany({
      where: { tenantId: access.tenantId },
      include: {
        user: {
          select: { id: true, name: true, email: true, image: true, role: true },
        },
      },
      orderBy: { joinedAt: "asc" },
    })

    return { members }
  } catch (error) {
    console.error("Error fetching members:", error)
    return { error: "Internal server error" }
  }
}

export async function createMemberAction(tenantSlug: string, data: z.infer<typeof createMemberSchema>) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return { error: "Unauthorized" }

    const access = await getTenantAccess(session, tenantSlug)
    if (!access) return { error: "Forbidden" }

    if (access.role !== "admin" && access.role !== "owner") {
      return { error: "Only admins and owners can add members" }
    }

    const tenantId = access.tenantId
    const tenantDb = await getTenantDb(tenantSlug)

    const { enforcePlanLimit } = await import("@/lib/plan-enforcement")
    const enforcement = await enforcePlanLimit(tenantId, "team_members", session.user.id)
    if (!enforcement.allowed) {
      return { error: enforcement.message }
    }

    const parsed = createMemberSchema.safeParse(data)
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Validation failed" }
    
    const { email, role, name, password, customPermissions } = parsed.data

    let user = await db.user.findUnique({ where: { email } })
    
    if (!user) {
      if (!password) {
        return { error: "User not found. Provide a password to create a new account." }
      }
      const hashedPassword = await hashPassword(password)
      user = await db.user.create({
        data: {
          email,
          name: name || email.split('@')[0],
          password: hashedPassword,
          role: "user",
          emailVerified: new Date(),
        }
      })
    }

    if (tenantDb !== db) {
      await tenantDb.user.upsert({
        where: { id: user.id },
        update: {
          email: user.email,
          name: user.name,
          password: user.password,
          role: user.role,
          image: user.image,
          emailVerified: user.emailVerified
        },
        create: {
          id: user.id,
          email: user.email,
          name: user.name,
          password: user.password,
          role: user.role,
          image: user.image,
          emailVerified: user.emailVerified
        }
      })
    }

    const existingMember = await db.tenantMember.findFirst({
      where: { tenantId: tenantId, userId: user.id },
    })

    if (existingMember) return { error: "User is already a member" }

    const member = await db.tenantMember.create({
      data: {
        tenantId: tenantId,
        userId: user.id,
        role: role,
        customPermissions: customPermissions ? customPermissions : undefined,
      },
      include: {
        user: { select: { id: true, name: true, email: true, image: true } },
      },
    })

    if (tenantDb !== db) {
      await tenantDb.tenantMember.upsert({
        where: {
          tenantId_userId: {
            tenantId: tenantId,
            userId: user.id
          }
        },
        update: { 
          role: role,
          customPermissions: customPermissions ? customPermissions : undefined,
        },
        create: {
          id: member.id,
          tenantId: tenantId,
          userId: user.id,
          role: role,
          customPermissions: customPermissions ? customPermissions : undefined,
        }
      })
    }

    revalidatePath(`/dashboard/${tenantSlug}/users`)

    return { member }
  } catch (error) {
    console.error("Error adding member:", error)
    return { error: "Internal server error" }
  }
}

export async function updateMemberAction(tenantSlug: string, memberId: string, data: z.infer<typeof updateMemberSchema>) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return { error: "Unauthorized" }

    const access = await getTenantAccess(session, tenantSlug)
    if (!access) return { error: "Forbidden" }

    if (access.role !== "admin" && access.role !== "owner" && session.user.role !== "super_admin") {
      return { error: "Forbidden" }
    }

    const tenantDb = await getTenantDb(tenantSlug)

    const parsed = updateMemberSchema.safeParse(data)
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Validation failed" }
    const { role, password } = parsed.data

    const member = await tenantDb.tenantMember.findUnique({
      where: { id: memberId },
      include: { user: true }
    })

    if (!member || member.tenantId !== access.tenantId) {
      return { error: "Member not found" }
    }

    if (role) {
      if (member.role === "owner" && role !== "owner") {
        const ownerCount = await tenantDb.tenantMember.count({
          where: { tenantId: access.tenantId, role: "owner" }
        })
        if (ownerCount <= 1) {
          return { error: "Cannot change the only owner's role" }
        }
      }
      
      await db.tenantMember.update({
        where: { id: memberId },
        data: { role }
      })

      if (tenantDb !== db) {
        await tenantDb.tenantMember.update({
          where: { id: memberId },
          data: { role }
        })
      }
    }

    if (password) {
      const hashedPassword = await hashPassword(password)
      await db.user.update({
        where: { id: member.userId },
        data: { password: hashedPassword }
      })

      if (tenantDb !== db) {
        await tenantDb.user.update({
          where: { id: member.userId },
          data: { password: hashedPassword }
        })
      }
    }

    revalidatePath(`/dashboard/${tenantSlug}/users`)
    return { success: true }
  } catch (error) {
    console.error("Error updating member:", error)
    return { error: "Internal server error" }
  }
}

export async function deleteMemberAction(tenantSlug: string, memberId: string) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return { error: "Unauthorized" }

    const access = await getTenantAccess(session, tenantSlug)
    if (!access) return { error: "Forbidden" }

    if (access.role !== "admin" && access.role !== "owner" && session.user.role !== "super_admin") {
      return { error: "Forbidden" }
    }

    const tenantDb = await getTenantDb(tenantSlug)

    const member = await tenantDb.tenantMember.findUnique({ where: { id: memberId } })
    if (!member || member.tenantId !== access.tenantId) return { error: "Member not found" }

    if (member.userId === session.user.id) return { error: "You cannot remove yourself" }

    if (member.role === "owner") {
      const ownerCount = await tenantDb.tenantMember.count({ where: { tenantId: access.tenantId, role: "owner" } })
      if (ownerCount <= 1) return { error: "Cannot remove the only owner" }
    }

    await db.tenantMember.delete({ where: { id: memberId } })
    if (tenantDb !== db) {
      await tenantDb.tenantMember.delete({ where: { id: memberId } })
    }

    revalidatePath(`/dashboard/${tenantSlug}/users`)
    return { success: true }
  } catch (error) {
    console.error("Error deleting member:", error)
    return { error: "Internal server error" }
  }
}
