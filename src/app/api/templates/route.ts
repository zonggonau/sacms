import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/database"

export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get templates content type
    const contentType = await db.contentType.findFirst({
      where: { 
        slug: "templates",
        tenantId: null 
      },
      select: { id: true },
    })

    if (!contentType) {
      return NextResponse.json({ templates: [] })
    }

    // Get template entries
    const entries = await db.contentEntry.findMany({
      where: {
        contentTypeId: contentType.id,
        status: "PUBLISHED",
      },
      orderBy: {
        createdAt: 'asc',
      },
    })

    const templates = entries.map(entry => {
      const data = typeof entry.data === 'string' ? JSON.parse(entry.data) : entry.data
      return {
        id: entry.id,
        name: data.name,
        description: data.description,
        icon: data.icon,
        template_id: data.template_id,
        schema_template: data.schema_template,
      }
    })

    return NextResponse.json({ templates })
  } catch (error) {
    console.error("Error fetching templates:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
