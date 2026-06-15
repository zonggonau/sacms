"use server"

import { db } from "@/lib/database"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import bcrypt from "bcrypt"
import { z } from "zod/v4"
import { revalidatePath } from "next/cache"

const updateProfileSchema = z.object({
  name: z.string().min(1, "Name is required").optional(),
  password: z.string().min(6, "Password must be at least 6 characters").optional(),
})

export async function getProfileAction() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return { error: "Unauthorized" }
    }

    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, name: true, email: true, role: true }
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

export async function updateProfileAction(data: { name?: string; password?: string }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return { error: "Unauthorized" }
    }

    const parsed = updateProfileSchema.safeParse(data)
    if (!parsed.success) {
      return { error: parsed.error.errors[0].message }
    }

    const updateData: any = {}
    if (parsed.data.name) updateData.name = parsed.data.name
    if (parsed.data.password) {
      updateData.password = await bcrypt.hash(parsed.data.password, 10)
    }

    const updatedUser = await db.user.update({
      where: { id: session.user.id },
      data: updateData,
      select: { id: true, name: true, email: true, role: true }
    })

    revalidatePath("/dashboard/settings/profile") // or wherever it's used
    
    return { success: true, user: updatedUser }
  } catch (error) {
    console.error("Error updating profile:", error)
    return { error: "Internal server error" }
  }
}
