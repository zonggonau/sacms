import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/database"
import { getTenantAccess } from "@/lib/tenant-access"
import { validateBody } from "@/lib/validate"
import { addLocaleSchema } from "@/lib/validations"

/**
 * GET /api/tenant/[tenant]/locales
 * List all locales for the tenant
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tenant: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { tenant } = await params
    const access = await getTenantAccess(session, tenant)
    if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const locales = await db.tenantLocale.findMany({
      where: { tenantId: access.tenantId },
      orderBy: [{ isDefault: "desc" }, { locale: "asc" }],
    })

    return NextResponse.json({ locales })
  } catch (error) {
    console.error("Error fetching locales:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * POST /api/tenant/[tenant]/locales
 * Add a locale to the tenant
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tenant: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { tenant } = await params
    const access = await getTenantAccess(session, tenant)
    if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    if (access.role !== "owner" && access.role !== "admin") {
      return NextResponse.json({ error: "Only admins can manage locales" }, { status: 403 })
    }

    const result = await validateBody(request, addLocaleSchema)
    if ("error" in result) return result.error

    const { locale, name, isDefault } = result.data

    // Check max 5 locales per tenant (v1.0)
    const count = await db.tenantLocale.count({
      where: { tenantId: access.tenantId },
    })
    if (count >= 5) {
      return NextResponse.json(
        { error: "Maximum 5 locales per tenant" },
        { status: 400 }
      )
    }

    // If setting as default, unset existing default
    if (isDefault) {
      await db.tenantLocale.updateMany({
        where: { tenantId: access.tenantId, isDefault: true },
        data: { isDefault: false },
      })
    }

    const tenantLocale = await db.tenantLocale.create({
      data: {
        tenantId: access.tenantId,
        locale,
        name,
        isDefault: isDefault || count === 0, // First locale is always default
      },
    })

    return NextResponse.json({ locale: tenantLocale }, { status: 201 })
  } catch (error: any) {
    if (error?.code === "P2002") {
      return NextResponse.json(
        { error: "Locale already exists for this tenant" },
        { status: 409 }
      )
    }
    console.error("Error adding locale:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
