"use server"

import { db } from "@/lib/database"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import bcrypt from "bcrypt"
import { z } from "zod/v4"
import { revalidatePath } from "next/cache"
import { rateLimit } from "@/lib/rate-limit"

// Matches SALT_ROUNDS in src/lib/auth.ts / src/lib/member-auth.ts (SEC-001).
const SALT_ROUNDS = 12

const updateProfileSchema = z.object({
  name: z.string().min(1, "Name is required").optional(),
  password: z.string().min(6, "Password must be at least 6 characters").optional(),
  currentPassword: z.string().optional(),
  image: z.string().optional().nullable(),
})

export async function getProfileAction() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return { error: "Unauthorized" }
    }

    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, name: true, email: true, role: true, image: true }
    })

    if (!user) {
      return { error: "User not found" }
    }

    return { user }
  } catch (error) {
    console.error("Error fetching profile:", error)
    return { error: "Internal server error" }
  }
}

export async function updateProfileAction(data: { name?: string; password?: string; currentPassword?: string; image?: string | null }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return { error: "Unauthorized" }
    }

    const parsed = updateProfileSchema.safeParse(data)
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Validation failed" }
    }

    const updateData: any = {}
    if (parsed.data.name) updateData.name = parsed.data.name
    if (parsed.data.image !== undefined) updateData.image = parsed.data.image
    if (parsed.data.password) {
      // A stolen/hijacked session shouldn't be enough on its own to take
      // permanent ownership of the account — require the current password
      // (same as every other "change password" flow) and throttle attempts
      // the same way login itself is throttled.
      const limited = await rateLimit(`profile-password:${session.user.id}`, { limit: 5, windowSeconds: 900 })
      if (!limited.success) {
        return { error: "Terlalu banyak percobaan ganti password. Coba lagi beberapa menit lagi." }
      }

      const currentUser = await db.user.findUnique({
        where: { id: session.user.id },
        select: { password: true },
      })
      if (currentUser?.password) {
        const matches = parsed.data.currentPassword
          ? await bcrypt.compare(parsed.data.currentPassword, currentUser.password)
          : false
        if (!matches) {
          return { error: "Password saat ini salah" }
        }
      }

      updateData.password = await bcrypt.hash(parsed.data.password, SALT_ROUNDS)
    }

    const updatedUser = await db.user.update({
      where: { id: session.user.id },
      data: updateData,
      select: { id: true, name: true, email: true, role: true, image: true }
    })

    revalidatePath("/dashboard/settings/profile") // or wherever it's used
    
    return { success: true, user: updatedUser }
  } catch (error) {
    console.error("Error updating profile:", error)
    return { error: "Internal server error" }
  }
}
