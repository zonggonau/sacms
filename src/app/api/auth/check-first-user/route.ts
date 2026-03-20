import { NextResponse } from "next/server"
import { db } from "@/lib/database"

export async function GET() {
  try {
    const userCount = await db.user.count()
    return NextResponse.json({
      isFirstUser: userCount === 0,
      userCount,
    })
  } catch (error) {
    console.error("Error checking first user:", error)
    return NextResponse.json({
      isFirstUser: false,
      userCount: 0,
    })
  }
}
