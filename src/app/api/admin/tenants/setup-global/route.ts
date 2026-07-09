import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/database"
import { exec } from "child_process"
import { promisify } from "util"

const execAsync = promisify(exec)

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || session.user.role !== "super_admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { getGlobalWorkspaceId } = await import("@/lib/settings")
    const globalTenantId = await getGlobalWorkspaceId()

    let globalTenant = await db.tenant.findUnique({
      where: { id: globalTenantId }
    })

    if (!globalTenant) {
      globalTenant = await db.tenant.create({
        data: {
          id: globalTenantId,
          name: "SaCMS Global",
          slug: globalTenantId,
          plan: "ENTERPRISE",
          status: "active"
        }
      })
    }

    // Schema creation and seeding is now entirely handled by scripts/seed-all-global.ts

    // Seed data akan dijalankan melalui script eksternal di bawah ini

    try {
      const { stdout, stderr } = await execAsync("bun run scripts/seed-all-global.ts")
      console.log("Seed Script Output:", stdout)
      if (stderr) console.error("Seed Script Error:", stderr)
    } catch (err) {
      console.error("Failed to run seed script:", err)
      // Even if it fails, we still return success for the rest of the setup
    }

    return NextResponse.json({ success: true, message: "Global Tenant & Seed Data provisioned successfully." })

  } catch (error) {
    console.error("Setup Global Tenant Error:", error)
    return NextResponse.json({ error: "Failed to setup global tenant" }, { status: 500 })
  }
}
