import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db, getTenantDb } from "@/lib/database"
import { authCorsPreflight, authCorsHeaders } from "@/lib/member-auth-cors"

export async function OPTIONS(
  request: NextRequest,
  { params }: { params: Promise<{ tenant: string }> },
) {
  const { tenant } = await params
  return authCorsPreflight(request, tenant)
}

const LogoutSchema = z.object({
  refreshToken: z.string().optional(),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tenant: string }> }
) {
  try {
    const { tenant: tenantSlug } = await params
    const tenant = await db.tenant.findFirst({
      where: { OR: [{ slug: tenantSlug }, { id: tenantSlug }] },
      select: { id: true, slug: true, customDomain: true, allowedAuthOrigins: true },
    })
    const cors = authCorsHeaders(
      request,
      tenant ? { slug: tenant.slug, customDomain: tenant.customDomain, allowedAuthOrigins: tenant.allowedAuthOrigins } : null,
    )

    const body = await request.json().catch(() => ({}))
    const parsed = LogoutSchema.safeParse(body)
    const refreshToken = parsed.success ? parsed.data.refreshToken : undefined

    if (refreshToken && tenant) {
      const tenantDb = (await getTenantDb(tenant.slug)) as any
      await tenantDb.memberSession.updateMany({
        where: { refreshToken, tenantId: tenant.id },
        data: { revokedAt: new Date() },
      })
    }

    return NextResponse.json(
      { message: "Logout berhasil. Sesi telah dinonaktifkan." },
      { status: 200, headers: cors },
    )
  } catch (error) {
    console.error("[public-auth/logout]", error)
    return NextResponse.json({ error: "Failed to logout" }, { status: 500 })
  }
}
