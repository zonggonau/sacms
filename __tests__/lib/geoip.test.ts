import { describe, it, expect, vi, beforeEach } from "vitest"
import { isPrivateIp, getCountryFlagEmoji, lookupGeoIp } from "@/lib/geoip"

describe("GeoIP Utility", () => {
  describe("isPrivateIp", () => {
    it("identifies localhost and loopback IPv4/IPv6", () => {
      expect(isPrivateIp("::1")).toBe(true)
      expect(isPrivateIp("127.0.0.1")).toBe(true)
      expect(isPrivateIp("localhost")).toBe(true)
      expect(isPrivateIp("0.0.0.0")).toBe(true)
      expect(isPrivateIp(null)).toBe(true)
      expect(isPrivateIp(undefined)).toBe(true)
    })

    it("identifies private IPv4 subnet ranges", () => {
      expect(isPrivateIp("10.0.0.1")).toBe(true)
      expect(isPrivateIp("10.255.255.255")).toBe(true)
      expect(isPrivateIp("172.16.0.1")).toBe(true)
      expect(isPrivateIp("172.31.255.255")).toBe(true)
      expect(isPrivateIp("192.168.1.1")).toBe(true)
      expect(isPrivateIp("192.168.100.254")).toBe(true)
    })

    it("identifies public IP addresses as non-private", () => {
      expect(isPrivateIp("8.8.8.8")).toBe(false)
      expect(isPrivateIp("180.252.164.12")).toBe(false)
      expect(isPrivateIp("1.1.1.1")).toBe(false)
      expect(isPrivateIp("104.28.19.45")).toBe(false)
    })
  })

  describe("getCountryFlagEmoji", () => {
    it("converts ISO-2 country codes to appropriate emoji flags", () => {
      expect(getCountryFlagEmoji("ID")).toBe("🇮🇩")
      expect(getCountryFlagEmoji("id")).toBe("🇮🇩")
      expect(getCountryFlagEmoji("US")).toBe("🇺🇸")
      expect(getCountryFlagEmoji("SG")).toBe("🇸🇬")
      expect(getCountryFlagEmoji("MY")).toBe("🇲🇾")
      expect(getCountryFlagEmoji("JP")).toBe("🇯🇵")
      expect(getCountryFlagEmoji("GB")).toBe("🇬🇧")
      expect(getCountryFlagEmoji("DE")).toBe("🇩🇪")
      expect(getCountryFlagEmoji("AU")).toBe("🇦🇺")
    })

    it("handles local and fallback codes", () => {
      expect(getCountryFlagEmoji("LOCAL")).toBe("🏠")
      expect(getCountryFlagEmoji("PRIVATE")).toBe("🏠")
      expect(getCountryFlagEmoji("XX")).toBe("🌐")
      expect(getCountryFlagEmoji(null)).toBe("🌐")
      expect(getCountryFlagEmoji("INVALID_LONG")).toBe("🌐")
    })
  })

  describe("lookupGeoIp", () => {
    it("returns local result for private IPs immediately without network call", async () => {
      const result = await lookupGeoIp("127.0.0.1")
      expect(result.isPrivate).toBe(true)
      expect(result.countryCode).toBe("LOCAL")
      expect(result.flag).toBe("🏠")
    })

    it("resolves public IP geolocation and produces country flag", async () => {
      const result = await lookupGeoIp("8.8.8.8")
      expect(result.isPrivate).toBe(false)
      expect(result.countryCode).toBeDefined()
      expect(result.flag).toBeDefined()
      expect(result.flag.length).toBeGreaterThan(0)
    })
  })
})
