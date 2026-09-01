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
 * Diagnoses live DNS records for a custom domain (Vercel-style Server Resolver)
 */
export async function diagnoseDomainDns(domain: string, tenantId: string): Promise<DnsDiagnosticsResult> {
  const info = parseDomainInfo(domain)
  const expectedRecords = getExpectedDnsRecords(domain, tenantId)
  const evaluatedRecords: ExpectedDnsRecord[] = []

  let routingValid = false
  let txtValid = false
  let hasMisconfiguration = false

  // Live DNS resolution
  let liveIps: string[] = []
  let liveCnames: string[] = []
  let liveTxts: string[] = []

  try {
    liveIps = await resolve4(info.domain)
  } catch {}

  try {
    liveCnames = await resolveCname(info.domain)
  } catch {}

  // Check routing validity
  const hasValidA = liveIps.includes(PUBLIC_GATEWAY_IP)
  const hasValidCname = liveCnames.some((c) => c.toLowerCase().includes(PUBLIC_CNAME_TARGET.toLowerCase()))

  if (hasValidA || hasValidCname) {
    routingValid = true
  }

  // Lookup TXT
  const lookupHost = info.isApex
    ? `_sacms-challenge.${info.rootDomain}`
    : `_sacms-challenge.${info.domain}`
  
  const fallbackLookupHost = `_sacms-verify.${info.domain}`

  try {
    const records = await resolveTxt(lookupHost)
    liveTxts = records.flat()
  } catch {
    try {
      const fallbackRecords = await resolveTxt(fallbackLookupHost)
      liveTxts = fallbackRecords.flat()
    } catch {}
  }

  const expectedToken = buildVerificationToken(tenantId)
  const isTxtMatch = liveTxts.some((t) => t.includes(expectedToken) || t.includes(tenantId))
  if (isTxtMatch) {
    txtValid = true
  }

  // Evaluate each row in the unified table
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
          actualValue: liveTxts[0] || expected.value,
          message: `Verifikasi TXT record berhasil.`,
        })
      } else if (liveTxts.length > 0) {
        evaluatedRecords.push({
          ...expected,
          status: "invalid",
          actualValue: liveTxts.join(", "),
          message: `TXT record ditemukan namun nilainya belum sesuai.`,
        })
        hasMisconfiguration = true
      } else {
        evaluatedRecords.push({
          ...expected,
          status: "not_found",
          actualValue: null,
          message: `TXT record verifikasi belum ditemukan.`,
        })
      }
    }
  }

  // Determine overall status
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
