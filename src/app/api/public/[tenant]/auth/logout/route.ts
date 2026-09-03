import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getTenantDb } from "@/lib/database"

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-api-key",
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
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
    const body = await request.json().catch(() => ({}))
    const parsed = LogoutSchema.safeParse(body)
    const refreshToken = parsed.success ? parsed.data.refreshToken : undefined

    if (refreshToken) {
      const tenantDb = (await getTenantDb(tenantSlug)) as any
      await tenantDb.memberSession.updateMany({
        where: { refreshToken },
        data: { revokedAt: new Date() }
      })
    }

    return NextResponse.json(
      { message: "Logout berhasil. Sesi telah dinonaktifkan." },
      { status: 200, headers: CORS_HEADERS }
    )
  } catch (error) {
    console.error("[public-auth/logout]", error)
    return NextResponse.json({ error: "Failed to logout" }, { status: 500, headers: CORS_HEADERS })
  }
}
