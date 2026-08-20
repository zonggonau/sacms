import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getTenantAccess } from "@/lib/tenant-access"
import { v0 } from "v0"

export async function GET(
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

    try {
      // Fetch up to 20 chats from V0
      const list = await (v0.chats as any).list({ limit: 20 })
      
      const chats = list?.data?.chats || []
      
      // We can group them into drafts and projects, or just return the raw list
      return NextResponse.json({ chats })
    } catch (v0Error: any) {
      console.error("V0 API Error:", v0Error)
      // If it's a rate limit error, we still want to return empty or a specific error message
      return NextResponse.json({ error: v0Error?.message || "Failed to fetch V0 chat history" }, { status: 500 })
    }
  } catch (error) {
    console.error("Error fetching AI builder history:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
