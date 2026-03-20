import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/database"
import { getTenantAccess } from "@/lib/tenant-access"

/**
 * GET /api/tenant/[tenant]/single-types/slug/[slug]
 * Get a single type by slug
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tenant: string; slug: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { tenant, slug } = await params

    const access = await getTenantAccess(session, tenant)
    if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    // Get single type by slug
    const singleType = await db.singleType.findUnique({
      where: { slug },
      include: {
        fields: {
          orderBy: {
            order: 'asc',
          },
        },
        tenants: true,
      },
    })

    if (!singleType) {
      return NextResponse.json({ error: "Single type not found" }, { status: 404 })
    }

    // Parse options from JSON strings
    const singleTypeWithParsedOptions = {
      ...singleType,
      isGlobal: singleType.tenants.length === 0,
      fields: singleType.fields.map((field: any) => ({
        ...field,
        options: field.options ? JSON.parse(field.options) : undefined,
      })),
    }

    return NextResponse.json(singleTypeWithParsedOptions)
  } catch (error) {
    console.error("Error fetching single type by slug:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}