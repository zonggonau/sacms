import { NextResponse } from "next/server"
import {
  checkDomainAvailability,
  getDomainPrice,
  convertUsdToIdr,
  SUPPORTED_TLDS,
  DomainSearchResult,
} from "@/lib/vercel-registrar"
import { withStaffAuth, apiError } from "@/lib/api/route-helpers"
import { rateLimit } from "@/lib/rate-limit"

export const GET = withStaffAuth(
  async (request, _context, { access }) => {
    // Each search fans out registrar lookups across every TLD — cap it.
    const rl = await rateLimit(`domain-search:${access.tenantId}`, { limit: 20, windowSeconds: 60 })
    if (!rl.success) {
      return apiError("rate_limited", { message: "Terlalu banyak pencarian domain. Coba lagi sebentar." })
    }

    const { searchParams } = new URL(request.url)
    const rawQuery = searchParams.get("query") || searchParams.get("name") || ""
    const query = rawQuery.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "")

    if (!query || query.length < 2 || query.length > 63) {
      return apiError("validation", { message: "Query domain minimal 2 karakter" })
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

    return NextResponse.json({ query, baseKeyword, results })
  },
  { minRole: "admin" },
)
