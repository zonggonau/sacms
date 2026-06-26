"use server"

import { db } from "@/lib/database"
import { revalidatePath } from "next/cache"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"

export async function deleteTemplateAction(entryId: string) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || (session.user.role !== "admin" && session.user.role !== "super_admin")) {
      return { error: "Unauthorized" }
    }

    await db.contentEntry.delete({
      where: { id: entryId }
    })

    revalidatePath("/admin/schema-builder")
    return { success: true }
  } catch (error: any) {
    console.error("Failed to delete template:", error)
    return { error: error.message || "Failed to delete template" }
  }
}
