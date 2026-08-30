/**
 * Vercel Registrar API Integration
 * Handles domain availability checking, pricing lookup in USD/IDR,
 * and automated domain purchasing with profit margin markup.
 */

export interface ContactInformation {
  firstName: string
  lastName: string
  address1: string
  city: string
  state: string
  postalCode: string
  country: string // 2-letter ISO code e.g. "ID", "US"
  phone: string   // E.164 format e.g. "+62.8123456789"
  email: string
  companyName?: string
}

export type TldCategory = "all" | "id" | "global" | "tech" | "budget"

export interface TldConfig {
  tld: string
  category: TldCategory
  name: string
  mockPriceUsd: number
  badge?: string
}

export const SUPPORTED_TLDS: TldConfig[] = [
  // Global
  { tld: "com", category: "global", name: ".com", mockPriceUsd: 14, badge: "Populer" },
  { tld: "net", category: "global", name: ".net", mockPriceUsd: 15 },
  { tld: "org", category: "global", name: ".org", mockPriceUsd: 15 },
  { tld: "co", category: "global", name: ".co", mockPriceUsd: 25 },
  { tld: "info", category: "global", name: ".info", mockPriceUsd: 12 },

  // Indonesia
  { tld: "id", category: "id", name: ".id", mockPriceUsd: 15, badge: "Resmi ID" },
  { tld: "co.id", category: "id", name: ".co.id", mockPriceUsd: 18, badge: "Bisnis ID" },
  { tld: "my.id", category: "id", name: ".my.id", mockPriceUsd: 2, badge: "Hemat" },
  { tld: "biz.id", category: "id", name: ".biz.id", mockPriceUsd: 3.5 },
  { tld: "web.id", category: "id", name: ".web.id", mockPriceUsd: 4 },

  // Tech & AI
  { tld: "io", category: "tech", name: ".io", mockPriceUsd: 45, badge: "Startup" },
  { tld: "ai", category: "tech", name: ".ai", mockPriceUsd: 85, badge: "AI Tech" },
  { tld: "dev", category: "tech", name: ".dev", mockPriceUsd: 16 },
  { tld: "app", category: "tech", name: ".app", mockPriceUsd: 16 },
  { tld: "tech", category: "tech", name: ".tech", mockPriceUsd: 18 },
  { tld: "cloud", category: "tech", name: ".cloud", mockPriceUsd: 18 },

  // Budget
  { tld: "xyz", category: "budget", name: ".xyz", mockPriceUsd: 3, badge: "Hemat" },
  { tld: "site", category: "budget", name: ".site", mockPriceUsd: 4 },
  { tld: "online", category: "budget", name: ".online", mockPriceUsd: 4 },
  { tld: "store", category: "budget", name: ".store", mockPriceUsd: 5 },
]

export interface DomainSearchResult {
  domain: string
  available: boolean
  priceUsd: number
  priceIdr: number
  periodYears: number
  category?: TldCategory
  badge?: string
  notice?: string
}

export interface PurchaseDomainParams {
  expectedPrice: number
  years?: number
  autoRenew?: boolean
  contactInformation: ContactInformation
}

export interface DomainPriceBreakdown {
  priceUsd: number
  exchangeRate: number
  baseIdr: number
  marginPercent: number
  percentMarkup: number
  marginFixedIdr: number
  totalMarginIdr: number
  finalPriceIdr: number
}

// Exchange rate settings & profit margin markup
const DEFAULT_USD_TO_IDR = 16600 // Conservative buffer rate for foreign exchange
const DEFAULT_MARGIN_PERCENT = 20 // 20% profit margin
const DEFAULT_MARGIN_FIXED_IDR = 25000 // Fixed administrative & processing markup in IDR

export interface ConvertOptions {
  marginPercent?: number
  marginFixedIdr?: number
  exchangeRate?: number
}

/**
 * Convert USD domain base price to IDR with configurable percentage + fixed profit margin.
 */
export function convertUsdToIdr(priceUsd: number, options?: ConvertOptions): number {
  const exchangeRate = options?.exchangeRate ?? (Number(process.env.USD_TO_IDR_RATE) || DEFAULT_USD_TO_IDR)
  const marginPercent = options?.marginPercent ?? (Number(process.env.DOMAIN_MARGIN_PERCENT) || DEFAULT_MARGIN_PERCENT)
  const marginFixed = options?.marginFixedIdr ?? (Number(process.env.DOMAIN_MARGIN_FIXED_IDR) || DEFAULT_MARGIN_FIXED_IDR)

  const baseIdr = priceUsd * exchangeRate
  const percentMarkup = baseIdr * (marginPercent / 100)

  // Round up to nearest 1,000 IDR
  const total = Math.ceil((baseIdr + percentMarkup + marginFixed) / 1000) * 1000
  return total
}

/**
 * Get detailed pricing and profit margin breakdown
 */
export function getDomainPriceBreakdown(priceUsd: number, options?: ConvertOptions): DomainPriceBreakdown {
  const exchangeRate = options?.exchangeRate ?? (Number(process.env.USD_TO_IDR_RATE) || DEFAULT_USD_TO_IDR)
  const marginPercent = options?.marginPercent ?? (Number(process.env.DOMAIN_MARGIN_PERCENT) || DEFAULT_MARGIN_PERCENT)
  const marginFixedIdr = options?.marginFixedIdr ?? (Number(process.env.DOMAIN_MARGIN_FIXED_IDR) || DEFAULT_MARGIN_FIXED_IDR)

  const baseIdr = Math.round(priceUsd * exchangeRate)
  const percentMarkup = Math.round(baseIdr * (marginPercent / 100))
  const finalPriceIdr = convertUsdToIdr(priceUsd, options)
  const totalMarginIdr = finalPriceIdr - baseIdr

  return {
    priceUsd,
    exchangeRate,
    baseIdr,
    marginPercent,
    percentMarkup,
    marginFixedIdr,
    totalMarginIdr,
    finalPriceIdr,
  }
}

/**
 * Check if a domain is available on Vercel Registrar
 */
export async function checkDomainAvailability(domain: string): Promise<{ available: boolean }> {
  const token = process.env.VERCEL_API_TOKEN
  const teamId = process.env.VERCEL_TEAM_ID

  if (!token) {
    // Sandbox / Mock simulation for development
    const clean = domain.toLowerCase().trim()
    const isMockAvailable = !clean.startsWith("taken") && !clean.startsWith("google") && !clean.startsWith("apple") && !clean.startsWith("microsoft")
    return { available: isMockAvailable }
  }

  try {
    const url = new URL(`https://api.vercel.com/v1/registrar/domains/${encodeURIComponent(domain)}/availability`)
    if (teamId) url.searchParams.set("teamId", teamId)

    const res = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      console.warn(`[Vercel Registrar] Availability check failed for ${domain}:`, err)
      return { available: false }
    }

    const data = await res.json()
    return { available: Boolean(data.available) }
  } catch (error) {
    console.error(`[Vercel Registrar] Error checking availability for ${domain}:`, error)
    return { available: false }
  }
}

/**
 * Get domain pricing from Vercel Registrar API (returns price in USD)
 */
export async function getDomainPrice(domain: string): Promise<{ priceUsd: number; periodYears: number }> {
  const token = process.env.VERCEL_API_TOKEN
  const teamId = process.env.VERCEL_TEAM_ID

  if (!token) {
    // Look up mock price from supported TLDs
    const clean = domain.toLowerCase().trim()
    const matchingTld = SUPPORTED_TLDS.find((t) => clean.endsWith(`.${t.tld}`))
    const mockPrice = matchingTld ? matchingTld.mockPriceUsd : 14
    return { priceUsd: mockPrice, periodYears: 1 }
  }

  try {
    const url = new URL(`https://api.vercel.com/v1/registrar/domains/${encodeURIComponent(domain)}/price`)
    if (teamId) url.searchParams.set("teamId", teamId)

    const res = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    })

    if (!res.ok) {
      console.warn(`[Vercel Registrar] Price check returned ${res.status} for ${domain}`)
      const matchingTld = SUPPORTED_TLDS.find((t) => domain.toLowerCase().endsWith(`.${t.tld}`))
      return { priceUsd: matchingTld ? matchingTld.mockPriceUsd : 14, periodYears: 1 }
    }

    const data = await res.json()
    return {
      priceUsd: typeof data.price === "number" ? data.price : 14,
      periodYears: typeof data.period === "number" ? data.period : 1,
    }
  } catch (error) {
    console.error(`[Vercel Registrar] Error fetching price for ${domain}:`, error)
    return { priceUsd: 14, periodYears: 1 }
  }
}

/**
 * Purchase a domain programmatically via Vercel Registrar API
 * This charges the primary card attached to the Vercel account.
 */
export async function purchaseDomain(
  domain: string,
  params: PurchaseDomainParams
): Promise<{ success: boolean; data?: any; error?: string }> {
  const token = process.env.VERCEL_API_TOKEN
  const teamId = process.env.VERCEL_TEAM_ID

  if (!token) {
    console.log(`[Vercel Registrar (Sandbox)] Simulated purchase for ${domain} (expected $${params.expectedPrice})`)
    return {
      success: true,
      data: {
        domain,
        simulated: true,
        registered: true,
        periodYears: params.years || 1,
        purchasedAt: new Date().toISOString(),
      },
    }
  }

  try {
    const url = new URL(`https://api.vercel.com/v1/registrar/domains/buy`)
    if (teamId) url.searchParams.set("teamId", teamId)

    const res = await fetch(url.toString(), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: domain,
        expectedPrice: params.expectedPrice,
        years: params.years || 1,
        autoRenew: params.autoRenew ?? true,
        contactInformation: params.contactInformation,
      }),
    })

    const data = await res.json()

    if (!res.ok) {
      console.error(`[Vercel Registrar] Failed to buy domain ${domain}:`, data)
      return {
        success: false,
        error: data.error?.message || data.message || "Gagal melakukan pembelian domain di registrar",
      }
    }

    return {
      success: true,
      data,
    }
  } catch (error: any) {
    console.error(`[Vercel Registrar] Exception buying domain ${domain}:`, error)
    return {
      success: false,
      error: error.message || "Terjadi kesalahan koneksi ke registrar domain",
    }
  }
}
