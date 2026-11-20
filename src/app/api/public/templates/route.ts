import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/database"

const DEFAULT_LIMIT = 21 // 3 columns x 7 rows, matching /templates' grid
const MAX_LIMIT = 60

/**
 * Public, paginated Website Template catalog — GET /api/public/templates.
 * Backs /templates' infinite scroll (initial page is server-rendered via
 * getPublishedWebsiteTemplates(), every page after that comes from here).
 * No tenant context, no auth — this is public marketing content.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const offset = Math.max(0, Number(searchParams.get("offset")) || 0)
    const limit = Math.min(MAX_LIMIT, Math.max(1, Number(searchParams.get("limit")) || DEFAULT_LIMIT))

    const rows = await db.websiteTemplate.findMany({
      where: { published: true },
      select: { id: true, name: true, slug: true, icon: true, description: true, demoUrl: true },
      orderBy: { createdAt: "desc" },
      skip: offset,
      take: limit + 1, // fetch one extra to know if there's a next page
    })

    const hasMore = rows.length > limit
    const templates = rows.slice(0, limit).map((t) => ({
      id: t.id,
      name: t.name,
      slug: t.slug,
      icon: t.icon,
      description: t.description || "",
      demoUrl: t.demoUrl || null,
    }))

    return NextResponse.json({ templates, hasMore, nextOffset: offset + templates.length })
  } catch (error) {
    console.error("[api/public/templates] Failed to list templates:", error)
    return NextResponse.json({ error: "Gagal memuat template" }, { status: 500 })
  }
}
