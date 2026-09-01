import { resolve4, resolveCname, resolveTxt } from "dns/promises"
import {
  PUBLIC_GATEWAY_IP,
  PUBLIC_CNAME_TARGET,
  parseDomainInfo,
  getExpectedDnsRecords,
  buildVerificationToken,
  DomainInfo,
  ExpectedDnsRecord,
  DnsDiagnosticsResult,
} from "./domain-parser"

export {
  PUBLIC_GATEWAY_IP,
  PUBLIC_CNAME_TARGET,
  parseDomainInfo,
  getExpectedDnsRecords,
  buildVerificationToken,
}
export type { DomainInfo, ExpectedDnsRecord, DnsDiagnosticsResult }

/**
 * Helper to resolve TXT records across multiple candidate hostnames in parallel with a timeout
 */
async function queryTxtCandidates(hosts: string[]): Promise<{ allTxts: string[]; matchedHost: string | null }> {
  const uniqueHosts = Array.from(new Set(hosts.filter(Boolean)))
  const results = await Promise.allSettled(
    uniqueHosts.map(async (host) => {
      const records = await Promise.race([
        resolveTxt(host),
        new Promise<string[][]>((_, reject) =>
          setTimeout(() => reject(new Error("DNS Timeout")), 3500)
        ),
      ])
      return { host, records }
    })
  )

  const allTxts: string[] = []
  let matchedHost: string | null = null

  for (const res of results) {
    if (res.status === "fulfilled" && Array.isArray(res.value.records)) {
      for (const chunks of res.value.records) {
        // RFC 1035: TXT records can be split across multiple string chunks
        const fullString = Array.isArray(chunks) ? chunks.join("") : String(chunks)
        const cleaned = fullString.trim().replace(/^["']|["']$/g, "").trim()
        if (cleaned) {
          allTxts.push(cleaned)
          if (!matchedHost) matchedHost = res.value.host
        }
      }
    }
  }

  return { allTxts, matchedHost }
}

/**
 * Diagnoses live DNS records for a custom domain (Vercel-style Server Resolver)
 */
export async function diagnoseDomainDns(domain: string, tenantId: string): Promise<DnsDiagnosticsResult> {
  const info = parseDomainInfo(domain)
  const expectedRecords = getExpectedDnsRecords(domain, tenantId)
  const evaluatedRecords: ExpectedDnsRecord[] = []

  let routingValid = false
  let txtValid = false
  let hasMisconfiguration = false

  // 1. Live DNS routing resolution (A & CNAME) in parallel
  let liveIps: string[] = []
  let liveCnames: string[] = []

  const [aResult, cnameResult] = await Promise.allSettled([
    Promise.race([
      resolve4(info.domain),
      new Promise<string[]>((_, reject) => setTimeout(() => reject(new Error("DNS Timeout")), 3500)),
    ]),
    Promise.race([
      resolveCname(info.domain),
      new Promise<string[]>((_, reject) => setTimeout(() => reject(new Error("DNS Timeout")), 3500)),
    ]),
  ])

  if (aResult.status === "fulfilled" && Array.isArray(aResult.value)) {
    liveIps = aResult.value
  }
  if (cnameResult.status === "fulfilled" && Array.isArray(cnameResult.value)) {
    liveCnames = cnameResult.value
  }

  // Check routing validity
  const hasValidA = liveIps.includes(PUBLIC_GATEWAY_IP)
  const hasValidCname = liveCnames.some((c) => c.toLowerCase().includes(PUBLIC_CNAME_TARGET.toLowerCase()))

  if (hasValidA || hasValidCname) {
    routingValid = true
  }

  // 2. Build multi-host candidates for TXT verification
  const expectedToken = buildVerificationToken(tenantId)
  const rawTokenHash = expectedToken.replace(/^sacms-verify=/, "").trim()

  const txtCandidates: string[] = info.isApex
    ? [
        `_sacms-challenge.${info.rootDomain}`,
        `_sacms-verify.${info.rootDomain}`,
        `_sacms-challenge.${info.domain}`,
        info.rootDomain,
      ]
    : [
        `_sacms-challenge.${info.domain}`,
        `_sacms-challenge.${info.subdomainPrefix}.${info.rootDomain}`,
        `_sacms-challenge.${info.rootDomain}`, // Apex verification inheritance
        `_sacms-verify.${info.domain}`,
        `_sacms-verify.${info.rootDomain}`,
        info.domain,
      ]

  const { allTxts: liveTxts } = await queryTxtCandidates(txtCandidates)

  // 3. Robust token matching (Full token, raw hash, or tenantId, case-insensitive)
  let matchedTxtRecord: string | null = null
  let foundMismatchedSacmsChallenge = false

  for (const txt of liveTxts) {
    const isExactToken = txt === expectedToken || txt.includes(expectedToken)
    const isRawHash = rawTokenHash.length > 8 && (txt === rawTokenHash || txt.includes(rawTokenHash))
    const isTenantId = tenantId.length > 6 && txt.includes(tenantId)
    const isCaseInsensitiveHash =
      rawTokenHash.length > 8 && txt.toLowerCase().includes(rawTokenHash.toLowerCase())

    if (isExactToken || isRawHash || isTenantId || isCaseInsensitiveHash) {
      txtValid = true
      matchedTxtRecord = txt
      break
    } else if (
      txt.toLowerCase().startsWith("sacms-verify=") ||
      txt.toLowerCase().startsWith("sacms-challenge=") ||
      txt.toLowerCase().startsWith("sacms=")
    ) {
      // User created a sacms-verify record, but the token value belongs to a different workspace
      foundMismatchedSacmsChallenge = true
    }
  }

  // 4. Evaluate each row in the unified table
  for (const expected of expectedRecords) {
    if (expected.type === "A") {
      if (hasValidA) {
        evaluatedRecords.push({
          ...expected,
          status: "valid",
          actualValue: liveIps.join(", "),
          message: `A Record valid mengarah ke ${PUBLIC_GATEWAY_IP}`,
        })
      } else if (hasValidCname) {
        evaluatedRecords.push({
          ...expected,
          status: "valid",
          actualValue: `Menggunakan rute CNAME (${liveCnames.join(", ")})`,
          message: `Rute domain terpenuhi melalui CNAME`,
        })
      } else if (liveIps.length > 0) {
        evaluatedRecords.push({
          ...expected,
          status: "invalid",
          actualValue: liveIps.join(", "),
          message: `Saat ini mengarah ke IP (${liveIps.join(", ")}), ubah menjadi ${PUBLIC_GATEWAY_IP}`,
        })
        hasMisconfiguration = true
      } else {
        evaluatedRecords.push({
          ...expected,
          status: routingValid ? "valid" : "not_found",
          actualValue: null,
          message: routingValid ? "Terpenuhi via CNAME" : `A Record belum ditemukan pada DNS server`,
        })
      }
    } else if (expected.type === "CNAME") {
      if (hasValidCname) {
        evaluatedRecords.push({
          ...expected,
          status: "valid",
          actualValue: liveCnames.join(", "),
          message: `CNAME valid mengarah ke ${PUBLIC_CNAME_TARGET}`,
        })
      } else if (hasValidA) {
        evaluatedRecords.push({
          ...expected,
          status: "valid",
          actualValue: `Menggunakan rute A Record (${liveIps.join(", ")})`,
          message: `Rute domain terpenuhi langsung melalui A Record`,
        })
      } else if (liveCnames.length > 0) {
        evaluatedRecords.push({
          ...expected,
          status: "invalid",
          actualValue: liveCnames.join(", "),
          message: `CNAME saat ini mengarah ke (${liveCnames.join(", ")}), ubah menjadi ${PUBLIC_CNAME_TARGET}`,
        })
        hasMisconfiguration = true
      } else {
        evaluatedRecords.push({
          ...expected,
          status: routingValid ? "valid" : "not_found",
          actualValue: null,
          message: routingValid ? "Terpenuhi via A Record" : `CNAME belum terdeteksi pada DNS`,
        })
      }
    } else if (expected.type === "TXT") {
      if (txtValid) {
        evaluatedRecords.push({
          ...expected,
          status: "valid",
          actualValue: matchedTxtRecord || expected.value,
          message: `Verifikasi TXT record berhasil.`,
        })
      } else if (foundMismatchedSacmsChallenge) {
        // Only flag as "invalid" (Salah) if an explicit SaCMS verification record was found but has the wrong token
        evaluatedRecords.push({
          ...expected,
          status: "invalid",
          actualValue: liveTxts.filter((t) => t.toLowerCase().includes("sacms")).join(", "),
          message: `TXT record SaCMS ditemukan namun token tidak cocok dengan workspace ini.`,
        })
        hasMisconfiguration = true
      } else {
        // Unrelated TXT records (SPF, Google Site Verification, DKIM) or not yet propagated -> "not_found" (Menunggu)
        evaluatedRecords.push({
          ...expected,
          status: "not_found",
          actualValue: null,
          message: `TXT record verifikasi belum terdeteksi pada DNS server.`,
        })
      }
    }
  }

  // 5. Determine overall domain status
  // Subdomain is verified if routing is valid OR TXT is valid
  // Apex domain requires valid routing AND (txtValid OR valid A routing)
  const isFullyVerified = routingValid && (txtValid || !info.isApex)
  let status: "verified" | "invalid_configuration" | "pending" = "pending"
  let summaryMessage = "Menunggu penyebaran DNS (DNS Propagation). Pastikan record DNS sudah ditambahkan."

  if (isFullyVerified) {
    status = "verified"
    summaryMessage = "Konfigurasi DNS valid dan domain aktif terhubung ke SaCMS."
  } else if (hasMisconfiguration) {
    status = "invalid_configuration"
    summaryMessage = "Konfigurasi DNS belum sesuai. Periksa petunjuk nilai target di bawah."
  }

  return {
    verified: isFullyVerified,
    status,
    domainInfo: info,
    records: evaluatedRecords,
    summaryMessage,
  }
}
