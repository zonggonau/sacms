import { describe, it, expect, vi, beforeEach } from "vitest"
import { getBaseUrl } from "@/lib/mail"

vi.mock("@/lib/settings", () => ({
  getPlatformSettings: vi.fn().mockResolvedValue({
    siteUrl: "https://sacms.cloud",
    resendApiKey: "",
    smtpHost: "",
  }),
  getResolvedMailConfig: vi.fn().mockResolvedValue({
    resendApiKey: "",
    resendFrom: "SaCMS <noreply@mail.sacms.cloud>",
    smtpHost: "",
    smtpPort: 587,
    smtpSecure: false,
    smtpUser: "",
    smtpPass: "",
    smtpFrom: "SaCMS <noreply@mail.sacms.cloud>",
  }),
  isMailConfigured: vi.fn().mockResolvedValue(false),
}))

describe("Mail Library Tests", () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.clearAllMocks()
    process.env = { ...originalEnv }
  })

  it("should resolve base URL from platform settings correctly", async () => {
    const url = await getBaseUrl()
    expect(url).toBe("https://sacms.cloud")
  })

  it("should fallback to production default if siteUrl is not configured in settings", async () => {
    const { getPlatformSettings } = await import("@/lib/settings")
    vi.mocked(getPlatformSettings).mockResolvedValueOnce({} as any)
    process.env.NODE_ENV = "production"
    delete process.env.NEXTAUTH_URL
    delete process.env.NEXT_PUBLIC_APP_URL

    const url = await getBaseUrl()
    expect(url).toBe("https://sacms.cloud")
  })

  it("should resolve localhost for local development", async () => {
    const { getPlatformSettings } = await import("@/lib/settings")
    vi.mocked(getPlatformSettings).mockResolvedValueOnce({} as any)
    process.env.NODE_ENV = "development"
    process.env.NEXTAUTH_URL = "http://localhost:3000"

    const url = await getBaseUrl()
    expect(url).toBe("http://localhost:3000")
  })
})
