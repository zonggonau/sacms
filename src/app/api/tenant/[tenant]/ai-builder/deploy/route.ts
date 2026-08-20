import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/database"
import { getTenantAccess } from "@/lib/tenant-access"
import { v0 } from "v0"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ tenant: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const resolvedParams = await params
    const access = await getTenantAccess(session, resolvedParams.tenant)
    
    if (!access || (access.role !== "admin" && access.role !== "owner" && access.role !== "super_admin")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await req.json()
    if (!body.chatId) {
      return NextResponse.json({ error: "chatId is required" }, { status: 400 })
    }

    // Call v0 API to deploy
    const response = await (v0.chats as any).deploy({
      chatId: body.chatId
    })

    // Update status to project
    await db.setting.upsert({
      where: { key: `${access.tenant.id}_v0Status` },
      update: { value: "project" },
      create: { tenantId: access.tenant.id, key: `${access.tenant.id}_v0Status`, value: "project" }
    })

    return NextResponse.json({ 
      success: true, 
      deploymentId: response?.deploymentId,
      vercelProjectId: response?.vercelProjectId 
    })

  } catch (error: any) {
    console.error("Error deploying to Vercel via V0:", error)
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 })
  }
}
