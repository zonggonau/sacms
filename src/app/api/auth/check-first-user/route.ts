import { NextResponse } from "next/server"
import { db } from "@/lib/database"
import { getEffectiveRegistrationMode } from "@/lib/registration-policy"

export async function GET() {
  try {
    const superAdmin = await db.user.findFirst({
      where: { role: "super_admin" },
      select: { id: true },
    })
    const registrationMode = await getEffectiveRegistrationMode().catch(() => "open" as const)
    return NextResponse.json({
      isFirstUser: !superAdmin,
      registrationOpen: registrationMode === "open",
    })
  } catch (error) {
    console.error("Error checking first user:", error)
    return NextResponse.json({
      isFirstUser: false,
      registrationOpen: true,
    })
  }
}

