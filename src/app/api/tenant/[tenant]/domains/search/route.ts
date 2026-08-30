import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getTenantAccess } from "@/lib/tenant-access"
import {
  checkDomainAvailability,
  getDomainPrice,
  convertUsdToIdr,
  SUPPORTED_TLDS,
  DomainSearchResult,
} from "@/lib/vercel-registrar"

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
    if (!access || !["owner", "admin"].includes(access.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const rawQuery = searchParams.get("query") || searchParams.get("name") || ""
    const query = rawQuery.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "")

    if (!query || query.length < 2) {
      return NextResponse.json({ error: "Query domain minimal 2 karakter" }, { status: 400 })
    }

    // Extract base keyword without TLD if user entered an extension
    let baseKeyword = query
    let exactDomainCandidate: string | null = null

    if (query.includes(".")) {
      exactDomainCandidate = query
      // Extract base name (e.g. "delvia" from "delvia.co.id" or "delvia.com")
      const matchedTld = SUPPORTED_TLDS.find((t) => query.endsWith(`.${t.tld}`))
      if (matchedTld) {
        baseKeyword = query.slice(0, -(matchedTld.tld.length + 1))
      } else {
        baseKeyword = query.split(".")[0]
      }
    }

    // Generate candidate domains across all supported TLDs
    const candidateDomains: Array<{ domain: string; isExact: boolean; category: any; badge?: string }> = []

    if (exactDomainCandidate) {
      const matchedTld = SUPPORTED_TLDS.find((t) => exactDomainCandidate!.endsWith(`.${t.tld}`))
      candidateDomains.push({
        domain: exactDomainCandidate,
        isExact: true,
        category: matchedTld?.category || "global",
        badge: "Pencarian Anda",
      })
    }

    // Add all supported TLDs for the base keyword
    for (const tldConfig of SUPPORTED_TLDS) {
      const candidate = `${baseKeyword}.${tldConfig.tld}`
      if (!candidateDomains.some((c) => c.domain === candidate)) {
        candidateDomains.push({
          domain: candidate,
          isExact: false,
          category: tldConfig.category,
          badge: tldConfig.badge,
        })
      }
    }

    // Check availability & pricing for each candidate in parallel
    const searchPromises = candidateDomains.map(async (item): Promise<DomainSearchResult> => {
      const [availRes, priceRes] = await Promise.all([
        checkDomainAvailability(item.domain),
        getDomainPrice(item.domain),
      ])

      const priceIdr = convertUsdToIdr(priceRes.priceUsd)

      return {
        domain: item.domain,
        available: availRes.available,
        priceUsd: priceRes.priceUsd,
        priceIdr,
        periodYears: priceRes.periodYears || 1,
        category: item.category,
        badge: item.badge,
      }
    })

    const results = await Promise.all(searchPromises)

    return NextResponse.json({
      query,
      baseKeyword,
      results,
    })
  } catch (error: any) {
    console.error("[Domain Search API] Error searching domain:", error)
    return NextResponse.json(
      { error: error.message || "Gagal melakukan pencarian domain" },
      { status: 500 }
    )
  }
}
