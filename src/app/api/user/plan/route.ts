import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/database"
import { USER_PLAN_LIMITS } from "@/lib/tenant-plan"

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { plan } = await request.json()

    if (!plan || !USER_PLAN_LIMITS[plan]) {
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 })
    }

    const updatedUser = await db.user.update({
      where: { id: session.user.id },
      data: { plan },
    })

    return NextResponse.json({ 
      message: "Plan updated successfully",
      plan: updatedUser.plan 
    })
  } catch (error) {
    console.error("Error updating user plan:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
