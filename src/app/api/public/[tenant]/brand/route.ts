import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/database"

/**
 * GET /api/public/[tenant]/brand
 * Public endpoint returning white-label branding data for a tenant.
 * Used by white-label frontends to style themselves accordingly.
 * No auth required — branding is public info.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ tenant: string }> }
) {
  try {
    const { tenant: tenantSlug } = await params

    const tenant = await db.tenant.findUnique({
      where: { slug: tenantSlug },
      select: {
        name: true,
        slug: true,
        logo: true,
        brandName: true,
        brandLogo: true,
        primaryColor: true,
        faviconUrl: true,
        customDomain: true,
        customDomainStatus: true,
      },
    })

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 })
    }

    return NextResponse.json({
      slug: tenant.slug,
      name: tenant.brandName || tenant.name,
      logo: tenant.brandLogo || tenant.logo,
      primaryColor: tenant.primaryColor || null,
      faviconUrl: tenant.faviconUrl || null,
      customDomain:
        tenant.customDomainStatus === "verified" ? tenant.customDomain : null,
    })
  } catch (error) {
    console.error("Error fetching brand:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
