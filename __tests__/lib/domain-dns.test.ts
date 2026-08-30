import { describe, it, expect } from "vitest"
import { parseDomainInfo, getExpectedDnsRecords, buildVerificationToken } from "@/lib/domain-dns"

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

  it("should generate CNAME Record and TXT Record for Subdomain", () => {
    const records = getExpectedDnsRecords("dpr.intanjayakab.go.id", "tenant-123")
    expect(records).toHaveLength(2)

    const cnameRecord = records.find((r) => r.type === "CNAME")
    expect(cnameRecord).toBeDefined()
    expect(cnameRecord?.name).toBe("dpr")
    expect(cnameRecord?.value).toContain("sacms.cloud")

    const txtRecord = records.find((r) => r.type === "TXT")
    expect(txtRecord).toBeDefined()
    expect(txtRecord?.name).toBe("_sacms-challenge.dpr")
  })

  it("should build deterministic verification tokens", () => {
    const token1 = buildVerificationToken("tenant-xyz")
    const token2 = buildVerificationToken("tenant-xyz")
    expect(token1).toBe(token2)
    expect(token1.startsWith("sacms-verify=")).toBe(true)
  })
})
