import { NextResponse } from "next/server"
import { db } from "@/lib/database"
import { rewritePublicMediaUrls } from "@/lib/public-media-url"

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

    // Every entry here is already queried PUBLISHED-only above, so this is
    // always safe to rewrite.
    const templates = contentType.entries.map(e => {
      try {
        const data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data
        return { id: e.id, ...rewritePublicMediaUrls(data) }
      } catch {
        return { id: e.id }
      }
    })

    return NextResponse.json({ data: templates })
  } catch (error) {
    return NextResponse.json({ data: [] })
  }
}
