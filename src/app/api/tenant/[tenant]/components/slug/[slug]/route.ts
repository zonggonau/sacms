import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/database"
import { getTenantAccess } from "@/lib/tenant-access"

/**
 * GET /api/tenant/[tenant]/components/slug/[slug]
 * Get a component by slug
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

    // Find component owned by this tenant OR global templates
    const component = await db.component.findFirst({
      where: {
        slug,
        OR: [
          { tenantId: access.tenantId },
          { tenantId: null }
        ]
      },
      include: {
        fields: {
          orderBy: {
            order: 'asc',
          },
        },
      },
    })

    if (!component) {
      return NextResponse.json({ error: "Component not found" }, { status: 404 })
    }

    // Parse options from JSON strings
    const componentWithParsedOptions = {
      ...component,
      isGlobal: component.tenantId === null,
      fields: component.fields.map((field: any) => ({
        ...field,
        options: field.options ? (typeof field.options === 'string' ? JSON.parse(field.options) : field.options) : undefined,
      })),
    }

    return NextResponse.json(componentWithParsedOptions)
  } catch (error) {
    console.error("Error fetching component by slug:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}