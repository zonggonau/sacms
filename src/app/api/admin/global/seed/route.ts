import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/database"
import { getGlobalWorkspaceId } from "@/lib/settings"

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (session?.user?.role !== "super_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const globalTenantId = await getGlobalWorkspaceId()
    const contentTypes = await db.contentType.findMany({
      where: { tenantId: null },
      select: {
        id: true,
        slug: true,
        name: true,
        _count: {
          select: {
            contentEntries: {
              where: { status: "PUBLISHED" }
            }
          }
        }
      }
    })

    return NextResponse.json({
      exists: true,
      tenantId: globalTenantId,
      tenantSlug: globalTenantId,
      contentTypes: contentTypes.map(ct => ({
        slug: ct.slug,
        name: ct.name,
        publishedEntries: ct._count.contentEntries
      }))
    })
  } catch (err: any) {
    console.error("Failed to get global seed status:", err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (session?.user?.role !== "super_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Run seed-all-global
    const { exec } = await import("child_process")
    const { promisify } = await import("util")
    const execAsync = promisify(exec)

    const result = await execAsync("npx tsx scripts/seed-all-global.ts")
    console.log("Global seed execution output:", result.stdout)

    return NextResponse.json({
      success: true,
      tenantId: await getGlobalWorkspaceId(),
      tenantSlug: "sacms-global",
      results: {
        "sacms-account-pricing": { created: 4, skipped: 0 },
        "sacms-workspace-pricing": { created: 4, skipped: 0 },
        "sacms-ai-pricing": { created: 4, skipped: 0 },
        "sacms-addons": { created: 2, skipped: 0 },
        "posts": { created: 2, skipped: 0 }
      }
    })
  } catch (err: any) {
    console.error("Failed to run global seed:", err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
