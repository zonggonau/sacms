import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/database"
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit"
import { resolveContentData } from "@/lib/content-resolver"
import { getCache, setCache } from "@/lib/cache"
import { SYSTEM_TENANT_SLUG } from "@/lib/constants"
import { createHash } from "crypto"

/**
 * Public API for Global Single Types (Landing Page components, FAQ, Hero, etc.)
 * Endpoint: /api/public/single/[singleType]
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ singleType: string }> }
) {
  try {
    const { singleType: singleTypeSlug } = await params
    const authHeader = request.headers.get("authorization")
    const token = authHeader?.replace("Bearer ", "")

    if (!token) {
      return NextResponse.json({ error: "Missing API token" }, { status: 401 })
    }

    // Rate limit
    const hashedToken = createHash("sha256").update(token).digest("hex")
    const rateLimitResult = await rateLimit(`public_single_global:${hashedToken}`, RATE_LIMITS.publicApi)
    if (!rateLimitResult.success) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 })
    }

    // Verify token
    const apiToken = await db.apiToken.findUnique({
      where: { token: hashedToken },
      include: { tenant: true },
    })

    if (!apiToken) {
      const systemApiKeySetting = await db.setting.findUnique({ where: { key: "systemApiKey" } })
      if (!systemApiKeySetting || systemApiKeySetting.value !== token) {
        return NextResponse.json({ error: "Invalid API token" }, { status: 401 })
      }
    }

    const { searchParams } = new URL(request.url)
    const defaultLocale = apiToken?.tenantId
      ? (await db.tenantLocale.findFirst({
          where: { tenantId: apiToken.tenantId, isDefault: true },
          select: { locale: true },
        }))?.locale || "en"
      : "en"
    const locale = searchParams.get("locale") || defaultLocale

    // Cache check only after authentication.
    const cacheOwner = apiToken ? `${apiToken.tenantId}:${apiToken.type}` : "system"
    const cacheKey = `public_api_single_global:${cacheOwner}:${singleTypeSlug}:${locale}`
    const cached = await getCache(cacheKey)
    if (cached) return NextResponse.json(cached, { headers: { "X-Cache": "HIT" } })

    // Get Single Type (Truly Global)
    const singleType = await db.singleType.findFirst({
      where: { slug: singleTypeSlug, tenantId: null },
      include: { schemaFields: { orderBy: { order: "asc" } } }
    })

    if (!singleType) return NextResponse.json({ error: "Single type not found" }, { status: 404 })

    // Find assignment for this single type (Try Truly Global first, then sacms-global fallback)
    let assignment = await db.tenantSingleTypeAssignment.findFirst({
      where: {
        singleTypeId: singleType.id,
        locale,
        OR: [
          { tenantId: null },
          { tenant: { slug: SYSTEM_TENANT_SLUG } },
          { tenant: { slug: "system" } }
        ]
      },
      orderBy: {
        tenantId: { sort: 'asc', nulls: 'first' }
      }
    })

    if (!assignment || !assignment.enabled) {
      return NextResponse.json({ error: "Single type data not published" }, { status: 404 })
    }

    if (apiToken && apiToken.type !== "full-access" && !assignment.publishedAt) {
      return NextResponse.json({ error: "Single type data not published" }, { status: 404 })
    }

    // Resolve data
    let rawData = assignment.data ? (typeof assignment.data === 'string' ? JSON.parse(assignment.data) : assignment.data) : {}
    
    // Resolve dynamic data (Relations and Components)
    const resolvedData = await resolveContentData(null as any, rawData, singleType.schemaFields)

    const responsePayload = {
      data: {
        ...resolvedData,
        publishedAt: assignment.publishedAt,
        updatedAt: assignment.updatedAt,
      },
      meta: {
        singleType: { name: singleType.name, slug: singleType.slug }
      }
    }

    await setCache(cacheKey, responsePayload, 300)
    return NextResponse.json(responsePayload)

  } catch (error) {
    console.error("Global Single Type API Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
