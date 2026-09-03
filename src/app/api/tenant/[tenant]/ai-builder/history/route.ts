import { NextResponse } from "next/server"
import { v0 } from "v0"
import { withStaffAuth } from "@/lib/api/route-helpers"

export const GET = withStaffAuth(
  async () => {
    try {
      const list = await (v0.chats as any).list({ limit: 20 })
      const chats = list?.data?.chats || []
      return NextResponse.json({ chats })
    } catch (v0Error: any) {
      console.error("V0 API Error:", v0Error)
      return NextResponse.json({ chats: [], error: "Failed to fetch V0 chat history" }, { status: 502 })
    }
  },
  { minRole: "admin" },
)
