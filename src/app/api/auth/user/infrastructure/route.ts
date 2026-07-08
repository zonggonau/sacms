import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/database"

export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Only Enterprise users can set master infrastructure
    if (session.user.plan !== "enterprise") {
      return NextResponse.json({ error: "Forbidden: Enterprise plan required" }, { status: 403 })
    }

    const data = await req.json()
    const { masterDatabaseUrl, masterStorageConfig } = data

    const updatedUser = await db.user.update({
      where: { id: session.user.id },
      data: {
        masterDatabaseUrl,
        masterStorageConfig,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Failed to update user infrastructure:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
