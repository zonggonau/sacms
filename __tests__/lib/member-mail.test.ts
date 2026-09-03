import { describe, it, expect, vi, beforeEach } from "vitest"

// Capture what dispatch() would send without touching Resend/SMTP.
const sent: Array<{ subject: string; html: string; to: string; from?: string | null }> = []

vi.mock("@/lib/settings", () => ({
  getPlatformSettings: vi.fn().mockResolvedValue({ siteUrl: "https://sacms.cloud" }),
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
}))

vi.mock("nodemailer", () => ({
  default: {
    createTransport: () => ({
      sendMail: (opts: any) => {
        sent.push({ subject: opts.subject, html: opts.html, to: opts.to, from: opts.from })
        return Promise.resolve({ messageId: "test", smtpHost: "x" })
      },
    }),
    createTestAccount: () => Promise.resolve({ user: "u", pass: "p" }),
    getTestMessageUrl: () => "https://ethereal.test/x",
  },
}))

vi.mock("resend", () => ({ Resend: class { emails = { send: () => Promise.resolve({ error: null, data: { id: "x" } }) } } }))

const baseTenant = {
  slug: "acme",
  name: "Acme Inc",
  brandName: null,
  customEmailSender: null,
  memberEmailConfirmationRedirect: null,
  memberPasswordResetRedirect: null,
}

describe("member auth emails", () => {
  beforeEach(() => {
    sent.length = 0
    vi.stubEnv("NODE_ENV", "test")
  })

  it("verification link falls back to the tenant-scoped SaCMS page with ?code=", async () => {
    const { sendMemberVerificationEmail } = await import("@/lib/mail")
    await sendMemberVerificationEmail(baseTenant, "user@example.com", "TOK123", "Sam")

    expect(sent).toHaveLength(1)
    expect(sent[0].to).toBe("user@example.com")
    expect(sent[0].html).toContain("https://sacms.cloud/t/acme/verify-email?code=TOK123")
    expect(sent[0].subject).toContain("Acme Inc")
  })

  it("verification link uses the tenant's configured frontend redirect when set", async () => {
    const { sendMemberVerificationEmail } = await import("@/lib/mail")
    await sendMemberVerificationEmail(
      { ...baseTenant, memberEmailConfirmationRedirect: "https://app.acme.com/confirm" },
      "user@example.com",
      "TOK999",
    )
    expect(sent[0].html).toContain("https://app.acme.com/confirm?code=TOK999")
  })

  it("password-reset link merges ?code= into a redirect that already has a query string", async () => {
    const { sendMemberPasswordResetEmail } = await import("@/lib/mail")
    await sendMemberPasswordResetEmail(
      { ...baseTenant, memberPasswordResetRedirect: "https://app.acme.com/reset?lang=en" },
      "user@example.com",
      "RESET42",
    )
    expect(sent[0].html).toContain("code=RESET42")
    expect(sent[0].html).toContain("lang=en")
  })

  it("uses the tenant's customEmailSender as the From address when present", async () => {
    const { sendMemberPasswordResetEmail } = await import("@/lib/mail")
    await sendMemberPasswordResetEmail(
      { ...baseTenant, customEmailSender: "Acme <no-reply@acme.com>" },
      "user@example.com",
      "R1",
    )
    expect(sent[0].from).toBe("Acme <no-reply@acme.com>")
  })
})
