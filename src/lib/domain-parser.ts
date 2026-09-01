export const PUBLIC_GATEWAY_IP = process.env.NEXT_PUBLIC_GATEWAY_IP || process.env.PUBLIC_GATEWAY_IP || "164.68.116.79"
export const PUBLIC_CNAME_TARGET = process.env.NEXT_PUBLIC_CNAME_TARGET || process.env.PUBLIC_CNAME_TARGET || "cname.sacms.cloud"

// Multi-part ccTLDs common in Indonesia and globally
const TWO_PART_TLDS = new Set([
  "go.id", "co.id", "ac.id", "sch.id", "or.id", "mil.id", "net.id", "web.id", "desa.id", "ponpes.id",
  "co.uk", "org.uk", "gov.uk", "ac.uk", "com.au", "net.au", "org.au", "co.jp", "ne.jp", "com.sg"
])

export interface DomainInfo {
  domain: string
  isApex: boolean
  subdomainPrefix: string
  rootDomain: string
}

export interface ExpectedDnsRecord {
  type: "A" | "CNAME" | "TXT"
  name: string
  value: string
  ttl: string
  required: boolean
  description: string
  status?: "valid" | "invalid" | "not_found"
  actualValue?: string | null
  message?: string
}

export interface DnsDiagnosticsResult {
  verified: boolean
  status: "verified" | "invalid_configuration" | "pending"
  domainInfo: DomainInfo
  records: ExpectedDnsRecord[]
  summaryMessage: string
}

/**
 * Parses a domain and determines if it is an Apex domain or Subdomain
 */
export function parseDomainInfo(domain: string): DomainInfo {
  const cleanDomain = domain.toLowerCase().trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "")
  const parts = cleanDomain.split(".")

  if (parts.length <= 1) {
    return {
      domain: cleanDomain,
      isApex: true,
      subdomainPrefix: "@",
      rootDomain: cleanDomain,
    }
  }

  // Check if ending matches a two-part TLD (e.g. intanjayakab.go.id)
  const lastTwo = parts.slice(-2).join(".")
  let isApex = false
  let rootDomain = cleanDomain
  let subdomainPrefix = "@"

  if (TWO_PART_TLDS.has(lastTwo)) {
    if (parts.length === 3) {
      isApex = true
      rootDomain = cleanDomain
      subdomainPrefix = "@"
    } else {
      isApex = false
      rootDomain = parts.slice(-3).join(".")
      subdomainPrefix = parts.slice(0, -3).join(".")
    }
  } else {
    // Single-part TLD (e.g. acme.com, portal.acme.com)
    if (parts.length === 2) {
      isApex = true
      rootDomain = cleanDomain
      subdomainPrefix = "@"
    } else {
      isApex = false
      rootDomain = parts.slice(-2).join(".")
      subdomainPrefix = parts.slice(0, -2).join(".")
    }
  }

  return {
    domain: cleanDomain,
    isApex,
    subdomainPrefix,
    rootDomain,
  }
}

/**
 * Builds a deterministic verification token for a tenant (browser/client-safe)
 */
export function buildVerificationToken(tenantId: string): string {
  const secret = "sacms-domain-verify"
  // Client-safe base64 / deterministic string token
  try {
    if (typeof btoa === "function") {
      return `sacms-verify=${btoa(`${tenantId}:${secret}`).replace(/[^a-zA-Z0-9]/g, "").slice(0, 32)}`
    }
    if (typeof Buffer !== "undefined") {
      return `sacms-verify=${Buffer.from(`${tenantId}:${secret}`).toString("base64").replace(/[^a-zA-Z0-9]/g, "").slice(0, 32)}`
    }
  } catch {}
  return `sacms-verify=${tenantId.slice(0, 24)}`
}

/**
 * Returns expected DNS records for a domain
 */
export function getExpectedDnsRecords(domain: string, tenantId: string): ExpectedDnsRecord[] {
  const info = parseDomainInfo(domain)
  const verifyToken = buildVerificationToken(tenantId)

  if (info.isApex) {
    return [
      {
        type: "A",
        name: "@",
        value: PUBLIC_GATEWAY_IP,
        ttl: "60 / Auto",
        required: true,
        description: "Mengarahkan apex domain ke IP Server SaCMS",
      },
      {
        type: "TXT",
        name: "_sacms-challenge",
        value: verifyToken,
        ttl: "60 / Auto",
        required: true,
        description: "Verifikasi kepemilikan domain untuk workspace Anda",
      },
    ]
  }

  return [
    {
      type: "CNAME",
      name: info.subdomainPrefix,
      value: PUBLIC_CNAME_TARGET,
      ttl: "60 / Auto",
      required: true,
      description: "Opsi 1: Routing CNAME ke Edge Server SaCMS",
    },
    {
      type: "A",
      name: info.subdomainPrefix,
      value: PUBLIC_GATEWAY_IP,
      ttl: "60 / Auto",
      required: false,
      description: "Opsi 2: Routing A Record langsung ke IP Server (Paling Cepat & Stabil)",
    },
    {
      type: "TXT",
      name: `_sacms-challenge.${info.subdomainPrefix}`,
      value: verifyToken,
      ttl: "60 / Auto",
      required: true,
      description: "Verifikasi kepemilikan subdomain oleh workspace Anda",
    },
  ]
}
