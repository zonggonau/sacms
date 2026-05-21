import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/database"
import { logApiRequest } from "@/lib/monitoring"

/**
 * GET /api/public/[tenant]/brand
 * Public endpoint returning white-label branding data for a tenant.
 * Used by white-label frontends to style themselves accordingly.
 * No auth required — branding is public info.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tenant: string }> }
) {
  const startTime = Date.now()
  const { tenant: tenantSlug } = await params
  let resolvedTenantId: string | null = tenantSlug

  const logResponse = (res: NextResponse) => {
    const duration = Date.now() - startTime
    logApiRequest({
      tenantId: resolvedTenantId,
      endpoint: request.nextUrl.pathname,
      method: request.method,
      statusCode: res.status,
      duration,
    }).catch(() => {})
    return res
  }

  try {
    const tenant = await db.tenant.findFirst({
      where: {
        OR: [{ slug: tenantSlug }, { id: tenantSlug }],
      },
      select: {
        id: true,
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
      return logResponse(NextResponse.json({ error: "Tenant not found" }, { status: 404 }))
    }

    resolvedTenantId = tenant.id

    return logResponse(NextResponse.json({
      slug: tenant.slug,
      name: tenant.brandName || tenant.name,
      logo: tenant.brandLogo || tenant.logo,
      primaryColor: tenant.primaryColor || null,
      faviconUrl: tenant.faviconUrl || null,
      customDomain:
        tenant.customDomainStatus === "verified" ? tenant.customDomain : null,
    }))
  } catch (error) {
    console.error("Error fetching brand:", error)
    const duration = Date.now() - startTime
    logApiRequest({
      tenantId: resolvedTenantId,
      endpoint: request.nextUrl.pathname,
      method: request.method,
      statusCode: 500,
      duration,
    }).catch(() => {})

    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
