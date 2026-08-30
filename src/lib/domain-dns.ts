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

  for (const expected of expectedRecords) {
    if (expected.type === "A") {
      try {
        const ips = await resolve4(info.domain)
        if (ips.includes(PUBLIC_GATEWAY_IP)) {
          evaluatedRecords.push({
            ...expected,
            status: "valid",
            actualValue: ips.join(", "),
            message: `A Record valid mengarah ke ${PUBLIC_GATEWAY_IP}`,
          })
          routingValid = true
        } else if (ips.length > 0) {
          evaluatedRecords.push({
            ...expected,
            status: "invalid",
            actualValue: ips.join(", "),
            message: `Domain saat ini mengarah ke IP (${ips.join(", ")}), ubah menjadi ${PUBLIC_GATEWAY_IP}`,
          })
          hasMisconfiguration = true
        } else {
          evaluatedRecords.push({
            ...expected,
            status: "not_found",
            actualValue: null,
            message: `A Record belum ditemukan pada DNS server`,
          })
        }
      } catch {
        evaluatedRecords.push({
          ...expected,
          status: "not_found",
          actualValue: null,
          message: `A Record belum terdeteksi. Silakan tambahkan A record di panel DNS Anda.`,
        })
      }
    } else if (expected.type === "CNAME") {
      try {
        let cnames: string[] = []
        try {
          cnames = await resolveCname(info.domain)
        } catch {
          // Fallback check if domain resolves to Gateway IP
          const ips: string[] = await resolve4(info.domain).catch(() => [] as string[])
          if (ips.includes(PUBLIC_GATEWAY_IP)) {
            routingValid = true
          }
        }

        const isCnameMatch = cnames.some((c) => c.toLowerCase().includes(PUBLIC_CNAME_TARGET.toLowerCase()))

        if (isCnameMatch || routingValid) {
          evaluatedRecords.push({
            ...expected,
            status: "valid",
            actualValue: cnames.length > 0 ? cnames.join(", ") : PUBLIC_GATEWAY_IP,
            message: `CNAME valid mengarah ke ${PUBLIC_CNAME_TARGET}`,
          })
          routingValid = true
        } else if (cnames.length > 0) {
          evaluatedRecords.push({
            ...expected,
            status: "invalid",
            actualValue: cnames.join(", "),
            message: `CNAME saat ini mengarah ke (${cnames.join(", ")}), ubah menjadi ${PUBLIC_CNAME_TARGET}`,
          })
          hasMisconfiguration = true
        } else {
          evaluatedRecords.push({
            ...expected,
            status: "not_found",
            actualValue: null,
            message: `CNAME record belum terdeteksi. Silakan tambahkan CNAME record pada panel DNS Anda.`,
          })
        }
      } catch {
        evaluatedRecords.push({
          ...expected,
          status: "not_found",
          actualValue: null,
          message: `CNAME record belum terdeteksi pada DNS.`,
        })
      }
    } else if (expected.type === "TXT") {
      const lookupHost = info.isApex
        ? `_sacms-challenge.${info.rootDomain}`
        : `_sacms-challenge.${info.domain}`
      
      const fallbackLookupHost = `_sacms-verify.${info.domain}`

      try {
        let txts: string[] = []
        try {
          const records = await resolveTxt(lookupHost)
          txts = records.flat()
        } catch {
          try {
            const fallbackRecords = await resolveTxt(fallbackLookupHost)
            txts = fallbackRecords.flat()
          } catch {}
        }

        const isMatch = txts.some((t) => t.includes(expected.value) || t.includes(buildVerificationToken(tenantId)))

        if (isMatch) {
          evaluatedRecords.push({
            ...expected,
            status: "valid",
            actualValue: txts[0] || expected.value,
            message: `Verifikasi TXT record berhasil.`,
          })
          txtValid = true
        } else if (txts.length > 0) {
          evaluatedRecords.push({
            ...expected,
            status: "invalid",
            actualValue: txts.join(", "),
            message: `TXT record ditemukan namun nilainya tidak sesuai.`,
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
      } catch {
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
