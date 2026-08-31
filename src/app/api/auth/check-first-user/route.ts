import { NextResponse } from "next/server"
import { db } from "@/lib/database"

export async function GET() {
  try {
    const superAdmin = await db.user.findFirst({
      where: { role: "super_admin" },
      select: { id: true },
    })
    return NextResponse.json({
      isFirstUser: !superAdmin,
    })
  } catch (error) {
    console.error("Error checking first user:", error)
    return NextResponse.json({
      isFirstUser: false,
    })
  }
}

