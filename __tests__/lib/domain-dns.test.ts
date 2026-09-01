import { describe, it, expect, vi, beforeEach } from "vitest"
import {
  parseDomainInfo,
  getExpectedDnsRecords,
  buildVerificationToken,
  diagnoseDomainDns,
  PUBLIC_GATEWAY_IP,
  PUBLIC_CNAME_TARGET,
} from "@/lib/domain-dns"

const mockResolve4 = vi.fn()
const mockResolveCname = vi.fn()
const mockResolveTxt = vi.fn()

vi.mock("dns/promises", () => ({
  resolve4: (...args: unknown[]) => mockResolve4(...args),
  resolveCname: (...args: unknown[]) => mockResolveCname(...args),
  resolveTxt: (...args: unknown[]) => mockResolveTxt(...args),
}))

describe("Domain DNS Utility", () => {
  it("should correctly identify Apex domain for Indonesian ccTLD (.go.id)", () => {
    const info = parseDomainInfo("intanjayakab.go.id")
    expect(info.isApex).toBe(true)
    expect(info.subdomainPrefix).toBe("@")
    expect(info.rootDomain).toBe("intanjayakab.go.id")
  })

  it("should correctly identify Subdomain for Indonesian ccTLD (dpr.intanjayakab.go.id)", () => {
    const info = parseDomainInfo("dpr.intanjayakab.go.id")
    expect(info.isApex).toBe(false)
    expect(info.subdomainPrefix).toBe("dpr")
    expect(info.rootDomain).toBe("intanjayakab.go.id")
  })

  it("should correctly identify multi-level subdomain (layanan.dinas.intanjayakab.go.id)", () => {
    const info = parseDomainInfo("layanan.dinas.intanjayakab.go.id")
    expect(info.isApex).toBe(false)
    expect(info.subdomainPrefix).toBe("layanan.dinas")
    expect(info.rootDomain).toBe("intanjayakab.go.id")
  })

  it("should correctly identify Apex domain for standard gTLD (acme.com)", () => {
    const info = parseDomainInfo("acme.com")
    expect(info.isApex).toBe(true)
    expect(info.subdomainPrefix).toBe("@")
    expect(info.rootDomain).toBe("acme.com")
  })

  it("should correctly identify Subdomain for standard gTLD (api.acme.com)", () => {
    const info = parseDomainInfo("api.acme.com")
    expect(info.isApex).toBe(false)
    expect(info.subdomainPrefix).toBe("api")
    expect(info.rootDomain).toBe("acme.com")
  })

  it("should generate A Record and TXT Record for Apex Domain", () => {
    const records = getExpectedDnsRecords("intanjayakab.go.id", "tenant-123")
    expect(records).toHaveLength(2)

    const aRecord = records.find((r) => r.type === "A")
    expect(aRecord).toBeDefined()
    expect(aRecord?.name).toBe("@")
    expect(aRecord?.value).toBeTruthy()

    const txtRecord = records.find((r) => r.type === "TXT")
    expect(txtRecord).toBeDefined()
    expect(txtRecord?.name).toBe("_sacms-challenge")
    expect(txtRecord?.value).toContain("sacms-verify=")
  })

  it("should generate CNAME Record, A Record, and TXT Record for Subdomain in unified list", () => {
    const records = getExpectedDnsRecords("dpr.intanjayakab.go.id", "tenant-123")
    expect(records).toHaveLength(3)

    const cnameRecord = records.find((r) => r.type === "CNAME")
    expect(cnameRecord).toBeDefined()
    expect(cnameRecord?.name).toBe("dpr")
    expect(cnameRecord?.value).toContain("sacms.cloud")

    const aRecord = records.find((r) => r.type === "A")
    expect(aRecord).toBeDefined()
    expect(aRecord?.name).toBe("dpr")
    expect(aRecord?.value).toBeTruthy()

    const txtRecord = records.find((r) => r.type === "TXT")
    expect(txtRecord).toBeDefined()
    expect(txtRecord?.name).toBe("_sacms-challenge.dpr")
  })

  it("should build deterministic verification tokens", () => {
    const token1 = buildVerificationToken("cmthbk5fs0000qw01f91hd7s")
    const token2 = buildVerificationToken("cmthbk5fs0000qw01f91hd7s")
    expect(token1).toBe(token2)
    expect(token1.startsWith("sacms-verify=")).toBe(true)
    expect(token1).toBe("sacms-verify=Y210aGJrNWZzMDAwMHF3MDFmOTFoZDdz")
  })
})

describe("diagnoseDomainDns Live Resolver Diagnostics", () => {
  const tenantId = "cmthbk5fs0000qw01f91hd7s"
  const expectedToken = buildVerificationToken(tenantId)

  beforeEach(() => {
    mockResolve4.mockReset()
    mockResolveCname.mockReset()
    mockResolveTxt.mockReset()
  })

  it("should diagnose subdomain with valid CNAME and TXT record with quotes", async () => {
    mockResolve4.mockRejectedValue(new Error("ENOTFOUND"))
    mockResolveCname.mockResolvedValue([PUBLIC_CNAME_TARGET])
    mockResolveTxt.mockImplementation(async (host: string) => {
      if (host.includes("_sacms-challenge.api")) {
        // Provider wrapped value in quotes
        return [[`"${expectedToken}"`]]
      }
      return []
    })

    const result = await diagnoseDomainDns("api.intanjayakab.go.id", tenantId)

    expect(result.verified).toBe(true)
    expect(result.status).toBe("verified")

    const txtRow = result.records.find((r) => r.type === "TXT")
    expect(txtRow?.status).toBe("valid")

    const cnameRow = result.records.find((r) => r.type === "CNAME")
    expect(cnameRow?.status).toBe("valid")
  })

  it("should diagnose subdomain when user puts raw token hash without sacms-verify= prefix", async () => {
    const rawHash = expectedToken.replace("sacms-verify=", "")

    mockResolve4.mockRejectedValue(new Error("ENOTFOUND"))
    mockResolveCname.mockResolvedValue([PUBLIC_CNAME_TARGET])
    mockResolveTxt.mockImplementation(async (host: string) => {
      if (host.includes("_sacms-challenge.api")) {
        return [[rawHash]]
      }
      return []
    })

    const result = await diagnoseDomainDns("api.intanjayakab.go.id", tenantId)

    expect(result.verified).toBe(true)
    const txtRow = result.records.find((r) => r.type === "TXT")
    expect(txtRow?.status).toBe("valid")
  })

  it("should handle multi-chunk RFC 1035 TXT records correctly", async () => {
    mockResolve4.mockRejectedValue(new Error("ENOTFOUND"))
    mockResolveCname.mockResolvedValue([PUBLIC_CNAME_TARGET])
    mockResolveTxt.mockImplementation(async (host: string) => {
      if (host.includes("_sacms-challenge.api")) {
        // Split into two chunks
        return [["sacms-verify=", "Y210aGJrNWZzMDAwMHF3MDFmOTFoZDdz"]]
      }
      return []
    })

    const result = await diagnoseDomainDns("api.intanjayakab.go.id", tenantId)

    expect(result.verified).toBe(true)
    const txtRow = result.records.find((r) => r.type === "TXT")
    expect(txtRow?.status).toBe("valid")
  })

  it("should NOT mark TXT as invalid ('Salah') when only unrelated SPF records exist", async () => {
    mockResolve4.mockRejectedValue(new Error("ENOTFOUND"))
    mockResolveCname.mockResolvedValue([PUBLIC_CNAME_TARGET])
    mockResolveTxt.mockImplementation(async () => {
      // Unrelated SPF record returned by wildcard DNS
      return [["v=spf1 include:_spf.google.com ~all"]]
    })

    const result = await diagnoseDomainDns("api.intanjayakab.go.id", tenantId)

    // Subdomain is still valid via CNAME routing
    expect(result.verified).toBe(true)
    const txtRow = result.records.find((r) => r.type === "TXT")
    // Should be not_found (Menunggu), NOT invalid (Salah)
    expect(txtRow?.status).toBe("not_found")
  })

  it("should mark TXT as invalid ('Salah') ONLY when an explicit sacms-verify record belongs to a different workspace", async () => {
    mockResolve4.mockRejectedValue(new Error("ENOTFOUND"))
    mockResolveCname.mockRejectedValue(new Error("ENOTFOUND"))
    mockResolveTxt.mockImplementation(async () => {
      return [["sacms-verify=DIFFERENT_WORKSPACE_TOKEN_12345"]]
    })

    const result = await diagnoseDomainDns("api.intanjayakab.go.id", tenantId)

    expect(result.verified).toBe(false)
    expect(result.status).toBe("invalid_configuration")

    const txtRow = result.records.find((r) => r.type === "TXT")
    expect(txtRow?.status).toBe("invalid")
  })
})


