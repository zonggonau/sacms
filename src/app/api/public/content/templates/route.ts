import { NextResponse } from "next/server"
import { db } from "@/lib/database"

export async function GET() {
  try {
    const contentType = await db.contentType.findFirst({
      where: { slug: "templates" },
      include: {
        entries: {
          where: { status: "PUBLISHED" }
        }
      }
    })

    if (!contentType) {
      return NextResponse.json({ data: [] })
    }

    const templates = contentType.entries.map(e => {
      try {
        const data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data
        return { id: e.id, ...data }
      } catch {
        return { id: e.id }
      }
    })

    return NextResponse.json({ data: templates })
  } catch (error) {
    return NextResponse.json({ data: [] })
  }
}
