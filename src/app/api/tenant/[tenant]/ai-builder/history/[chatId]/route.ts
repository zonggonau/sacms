import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getTenantAccess } from "@/lib/tenant-access"
import { getV0ChatMessages, getV0Preview } from "@/lib/v0-client"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ tenant: string; chatId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const resolvedParams = await params
    const access = await getTenantAccess(session, resolvedParams.tenant)
    
    if (!access) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const messages = await getV0ChatMessages(resolvedParams.chatId)
    const previewUrl = await getV0Preview(resolvedParams.chatId)

    // Format messages for the frontend (assumes role 'user' and 'ai')
    const formattedMessages = messages.map((m: any) => ({
      role: m.role === 'user' ? 'user' : 'ai',
      content: m.content || m.text || "Message content"
    }))

    return NextResponse.json({ 
      success: true, 
      messages: formattedMessages,
      previewUrl
    })

  } catch (error: any) {
    console.error("Error fetching chat messages:", error)
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 })
  }
}
