import nodemailer from "nodemailer"
import { Resend } from "resend"
import { getResolvedMailConfig, getPlatformSettings } from "./settings"

// Cached transporter per config signature
let cachedTransporter: nodemailer.Transporter | null = null
let cachedSignature = ""

async function getTransporter(): Promise<nodemailer.Transporter | null> {
  const config = await getResolvedMailConfig()
  const sig = `${config.smtpHost}:${config.smtpPort}:${config.smtpUser}:${config.smtpPass}:${config.smtpSecure}`

  if (cachedTransporter && cachedSignature === sig) {
    return cachedTransporter
  }

  if (config.smtpHost && config.smtpPort) {
    // Use real SMTP server from settings or .env
    cachedTransporter = nodemailer.createTransport({
      host: config.smtpHost,
      port: config.smtpPort,
      secure: config.smtpSecure,
      auth: config.smtpUser ? {
        user: config.smtpUser,
        pass: config.smtpPass,
      } : undefined,
    })
    cachedSignature = sig
    return cachedTransporter
  }

  if (process.env.NODE_ENV !== "production") {
    // Generate test SMTP service account from ethereal.email in dev only
    try {
      console.warn("No SMTP config found. Using Ethereal Email for local dev...")
      const testAccount = await nodemailer.createTestAccount()
      
      cachedTransporter = nodemailer.createTransport({
        host: "smtp.ethereal.email",
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      })
      cachedSignature = "ethereal"
      return cachedTransporter
    } catch {
      return null
    }
  }

  return null
}

async function getResendClient(): Promise<{ client: Resend | null; fromEmail: string }> {
  const config = await getResolvedMailConfig()
  if (config.resendApiKey) {
    return {
      client: new Resend(config.resendApiKey),
      fromEmail: config.resendFrom || "SaCMS <noreply@mail.sacms.cloud>",
    }
  }
  return { client: null, fromEmail: config.resendFrom || "SaCMS <noreply@mail.sacms.cloud>" }
}

export async function getBaseUrl(): Promise<string> {
  try {
    const settings = await getPlatformSettings()
    if (settings.siteUrl && settings.siteUrl.startsWith("http")) {
      return settings.siteUrl.replace(/\/$/, "")
    }
  } catch {}

  if (process.env.NEXT_PUBLIC_APP_URL && process.env.NEXT_PUBLIC_APP_URL.startsWith("http")) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "")
  }
  if (process.env.NEXTAUTH_URL && process.env.NEXTAUTH_URL.startsWith("http") && !process.env.NEXTAUTH_URL.includes("localhost")) {
    return process.env.NEXTAUTH_URL.replace(/\/$/, "")
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`.replace(/\/$/, "")
  }
  if (process.env.NODE_ENV === "production") {
    return "https://sacms.cloud"
  }
  return process.env.NEXTAUTH_URL?.replace(/\/$/, "") || "http://localhost:3000"
}

export async function sendVerificationEmail(email: string, token: string, name: string = "User") {
  const baseUrl = await getBaseUrl()
  const verifyUrl = `${baseUrl}/api/auth/verify?token=${token}`
  const subject = "Verifikasi Alamat Email Anda — SaCMS"
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
      <div style="margin-bottom: 20px; border-bottom: 2px solid #f97316; padding-bottom: 12px;">
        <span style="font-size: 20px; font-weight: 900; color: #0f172a; letter-spacing: -0.5px;">Sa<span style="color: #f97316;">CMS</span></span>
      </div>
      <h2 style="color: #0f172a; margin-top: 0;">Selamat Datang di SaCMS!</h2>
      <p style="color: #334155; font-size: 15px; line-height: 1.6;">Halo <strong>${name}</strong>,</p>
      <p style="color: #475569; font-size: 14px; line-height: 1.6;">Terima kasih telah mendaftar di SaCMS (Smart Content Management System). Silakan klik tombol di bawah untuk memverifikasi alamat email Anda dan mengaktifkan akun:</p>
      <div style="margin: 28px 0;">
        <a href="${verifyUrl}" style="background-color: #f97316; color: white; padding: 12px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 14px; display: inline-block; box-shadow: 0 4px 12px rgba(249, 115, 22, 0.25);">Verifikasi Email Saya</a>
      </div>
      <p style="color: #64748b; font-size: 13px;">Atau salin tautan berikut ke browser Anda:</p>
      <p style="word-break: break-all; color: #f97316; font-size: 13px;"><a href="${verifyUrl}" style="color: #f97316;">${verifyUrl}</a></p>
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
      <p style="color: #94a3b8; font-size: 12px;">Jika Anda tidak merasa mendaftar di SaCMS, abaikan email ini.</p>
    </div>
  `

  const { client: resend, fromEmail } = await getResendClient()
  if (resend) {
    try {
      console.log(`[Mail] Attempting to send verification email to ${email} via Resend (${fromEmail})...`)
      const res = await resend.emails.send({
        from: fromEmail,
        to: email,
        subject,
        html,
      })

      if (res.error) {
        console.warn("⚠️ [Mail] Resend returned error, falling back to SMTP:", res.error.message || JSON.stringify(res.error))
      } else {
        console.log("✅ [Mail] Verification email successfully sent via Resend. ID:", res.data?.id)
        return res
      }
    } catch (err: any) {
      console.warn("⚠️ [Mail] Resend exception, falling back to SMTP:", err?.message || err)
    }
  }

  // Fallback to SMTP / Ethereal
  try {
    const t = await getTransporter()
    if (!t) {
      console.warn("⚠️ [Mail] No email provider (Resend or SMTP) configured. Skipping email dispatch.")
      throw new Error("Layanan email belum dikonfigurasi di Super Admin Settings.")
    }
    const mailConfig = await getResolvedMailConfig()
    const info = await t.sendMail({
      from: mailConfig.smtpFrom || fromEmail || '"SaCMS" <noreply@mail.sacms.cloud>',
      to: email,
      subject,
      html,
    })

    if (info.messageId && !mailConfig.smtpHost) {
      console.log("=========================================")
      console.log("✉️  VERIFICATION EMAIL SENT TO ETHEREAL!")
      console.log("Preview URL: %s", nodemailer.getTestMessageUrl(info))
      console.log("=========================================")
    } else {
      console.log("✅ [Mail] Verification email sent via SMTP. MessageId:", info.messageId)
    }
    return info
  } catch (smtpErr: any) {
    console.error("❌ [Mail] SMTP send error:", smtpErr)
    throw new Error(smtpErr?.message || "Gagal mengirim email verifikasi via SMTP.")
  }
}

export async function sendPasswordResetEmail(email: string, token: string) {
  const baseUrl = await getBaseUrl()
  const resetUrl = `${baseUrl}/reset-password?token=${token}`
  const subject = "Atur Ulang Kata Sandi — SaCMS"
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
      <div style="margin-bottom: 20px; border-bottom: 2px solid #f97316; padding-bottom: 12px;">
        <span style="font-size: 20px; font-weight: 900; color: #0f172a; letter-spacing: -0.5px;">Sa<span style="color: #f97316;">CMS</span></span>
      </div>
      <h2 style="color: #0f172a; margin-top: 0;">Permintaan Reset Kata Sandi</h2>
      <p style="color: #475569; font-size: 14px; line-height: 1.6;">Kami menerima permintaan untuk mengatur ulang kata sandi akun SaCMS Anda. Klik tombol di bawah untuk membuat kata sandi baru:</p>
      <div style="margin: 28px 0;">
        <a href="${resetUrl}" style="background-color: #f97316; color: white; padding: 12px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 14px; display: inline-block; box-shadow: 0 4px 12px rgba(249, 115, 22, 0.25);">Atur Ulang Kata Sandi</a>
      </div>
      <p style="color: #64748b; font-size: 13px;">Atau salin tautan berikut ke browser Anda:</p>
      <p style="word-break: break-all; color: #f97316; font-size: 13px;"><a href="${resetUrl}" style="color: #f97316;">${resetUrl}</a></p>
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
      <p style="color: #94a3b8; font-size: 12px;">Jika Anda tidak meminta reset kata sandi, abaikan email ini.</p>
    </div>
  `

  const { client: resend, fromEmail } = await getResendClient()
  if (resend) {
    try {
      console.log(`[Mail] Attempting to send password reset email to ${email} via Resend (${fromEmail})...`)
      const res = await resend.emails.send({
        from: fromEmail,
        to: email,
        subject,
        html,
      })

      if (res.error) {
        console.warn("⚠️ [Mail] Resend returned error on password reset, falling back to SMTP:", res.error.message || JSON.stringify(res.error))
      } else {
        console.log("✅ [Mail] Password reset email successfully sent via Resend. ID:", res.data?.id)
        return res
      }
    } catch (err: any) {
      console.warn("⚠️ [Mail] Resend password reset exception, falling back to SMTP:", err?.message || err)
    }
  }

  // Fallback to SMTP
  try {
    const t = await getTransporter()
    if (!t) {
      throw new Error("Layanan email belum dikonfigurasi di Super Admin Settings.")
    }
    const mailConfig = await getResolvedMailConfig()
    const info = await t.sendMail({
      from: mailConfig.smtpFrom || fromEmail || '"SaCMS" <noreply@mail.sacms.cloud>',
      to: email,
      subject,
      html,
    })
    console.log("✅ [Mail] Password reset email sent via SMTP. MessageId:", info.messageId)
    return info
  } catch (smtpErr: any) {
    console.error("❌ [Mail] SMTP password reset error:", smtpErr)
    throw new Error(smtpErr?.message || "Gagal mengirim email reset kata sandi via SMTP.")
  }
}


/**
 * Build a member-facing auth link. Headless members live under a tenant and
 * their frontend is the developer's own app, so the link points at a
 * tenant-configured redirect when set, otherwise a SaCMS-hosted fallback page
 * scoped to the tenant. The one-time code is always passed as `?code=`.
 */
function buildMemberAuthLink(
  redirect: string | null | undefined,
  fallbackPath: string,
  code: string,
): string {
  if (redirect && /^https?:\/\//.test(redirect)) {
    const url = new URL(redirect)
    url.searchParams.set("code", code)
    return url.toString()
  }
  // fallbackPath already includes the tenant slug, e.g. /t/acme/verify-email
  return `${fallbackPath}${fallbackPath.includes("?") ? "&" : "?"}code=${encodeURIComponent(code)}`
}

async function dispatch(
  subject: string,
  html: string,
  to: string,
  fromOverride?: string | null,
) {
  const { client: resend, fromEmail } = await getResendClient()
  if (resend) {
    try {
      const res = await resend.emails.send({ from: fromOverride || fromEmail, to, subject, html })
      if (!res.error) {
        console.log("✅ [Mail] sent via Resend. ID:", res.data?.id)
        return res
      }
      console.warn("⚠️ [Mail] Resend error, falling back to SMTP:", res.error.message || JSON.stringify(res.error))
    } catch (err: any) {
      console.warn("⚠️ [Mail] Resend exception, falling back to SMTP:", err?.message || err)
    }
  }

  const t = await getTransporter()
  if (!t) {
    throw new Error("Layanan email belum dikonfigurasi (Resend API key atau SMTP).")
  }
  const mailConfig = await getResolvedMailConfig()
  const info = await t.sendMail({
    from: fromOverride || mailConfig.smtpFrom || fromEmail || '"SaCMS" <noreply@mail.sacms.cloud>',
    to,
    subject,
    html,
  })
  if (info.messageId && !mailConfig.smtpHost) {
    console.log("✉️  [Mail] Ethereal preview:", nodemailer.getTestMessageUrl(info))
  } else {
    console.log("✅ [Mail] sent via SMTP. MessageId:", info.messageId)
  }
  return info
}

type MemberMailTenant = {
  slug: string
  name?: string | null
  brandName?: string | null
  customEmailSender?: string | null
  memberEmailConfirmationRedirect?: string | null
  memberPasswordResetRedirect?: string | null
}

/** Headless-member email-verification email, tenant-aware. */
export async function sendMemberVerificationEmail(
  tenant: MemberMailTenant,
  email: string,
  code: string,
  name: string = "there",
) {
  const baseUrl = await getBaseUrl()
  const link = buildMemberAuthLink(
    tenant.memberEmailConfirmationRedirect,
    `${baseUrl}/t/${tenant.slug}/verify-email`,
    code,
  )
  const brand = tenant.brandName || tenant.name || "the team"
  const subject = `Verify your email — ${brand}`
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
      <h2 style="color: #0f172a; margin-top: 0;">Confirm your email address</h2>
      <p style="color: #475569; font-size: 14px; line-height: 1.6;">Hi <strong>${name}</strong>, welcome to ${brand}. Please confirm your email address to activate your account:</p>
      <div style="margin: 28px 0;">
        <a href="${link}" style="background-color: #f97316; color: white; padding: 12px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 14px; display: inline-block;">Confirm email</a>
      </div>
      <p style="color: #64748b; font-size: 13px;">Or paste this link into your browser:</p>
      <p style="word-break: break-all; color: #f97316; font-size: 13px;"><a href="${link}" style="color: #f97316;">${link}</a></p>
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
      <p style="color: #94a3b8; font-size: 12px;">This link expires in 24 hours. If you didn't create an account, you can ignore this email.</p>
    </div>`
  return dispatch(subject, html, email, tenant.customEmailSender)
}

/** Headless-member password-reset email, tenant-aware. */
export async function sendMemberPasswordResetEmail(
  tenant: MemberMailTenant,
  email: string,
  code: string,
) {
  const baseUrl = await getBaseUrl()
  const link = buildMemberAuthLink(
    tenant.memberPasswordResetRedirect,
    `${baseUrl}/t/${tenant.slug}/reset-password`,
    code,
  )
  const brand = tenant.brandName || tenant.name || "the team"
  const subject = `Reset your password — ${brand}`
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
      <h2 style="color: #0f172a; margin-top: 0;">Reset your password</h2>
      <p style="color: #475569; font-size: 14px; line-height: 1.6;">We received a request to reset the password for your ${brand} account. Click below to choose a new password:</p>
      <div style="margin: 28px 0;">
        <a href="${link}" style="background-color: #f97316; color: white; padding: 12px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 14px; display: inline-block;">Reset password</a>
      </div>
      <p style="color: #64748b; font-size: 13px;">Or paste this link into your browser:</p>
      <p style="word-break: break-all; color: #f97316; font-size: 13px;"><a href="${link}" style="color: #f97316;">${link}</a></p>
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
      <p style="color: #94a3b8; font-size: 12px;">This link expires in 1 hour. If you didn't request this, you can ignore this email.</p>
    </div>`
  return dispatch(subject, html, email, tenant.customEmailSender)
}


export async function sendSupportNotificationEmail({
  to,
  recipientName = "Pengguna SaCMS",
  ticketId,
  subject,
  senderName,
  senderRole,
  messagePreview,
  viewUrl,
}: {
  to: string
  recipientName?: string
  ticketId: string
  subject: string
  senderName: string
  senderRole: "user" | "admin"
  messagePreview: string
  viewUrl: string
}) {
  const isFromAdmin = senderRole === "admin"
  const emailSubject = isFromAdmin
    ? `[Support SaCMS] Balasan Tiket #${ticketId.slice(-6)}: ${subject}`
    : `[Tiket Baru #${ticketId.slice(-6)}] Pesan dari ${senderName}: ${subject}`

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
      <div style="margin-bottom: 20px; border-bottom: 2px solid #f97316; padding-bottom: 12px;">
        <span style="font-size: 20px; font-weight: 900; color: #0f172a; letter-spacing: -0.5px;">Sa<span style="color: #f97316;">CMS</span> Support</span>
      </div>
      <h3 style="color: #0f172a; margin-top: 0;">Halo ${recipientName},</h3>
      <p style="color: #475569; font-size: 14px; line-height: 1.6;">
        ${isFromAdmin ? `Tim IT / Customer Support SaCMS telah membalas tiket pertanyaan Anda:` : `Ada pesan baru dari <strong>${senderName}</strong> untuk tiket support:`}
      </p>
      <div style="background-color: #f8fafc; border-left: 4px solid #f97316; padding: 16px; margin: 20px 0; border-radius: 6px;">
        <div style="font-size: 11px; font-weight: bold; text-transform: uppercase; color: #64748b; margin-bottom: 6px;">
          Tiket: ${subject} (#${ticketId.slice(-6)})
        </div>
        <p style="margin: 0; color: #1e293b; font-size: 14px; font-style: italic; white-space: pre-wrap;">"${messagePreview}"</p>
      </div>
      <div style="margin: 30px 0;">
        <a href="${viewUrl}" style="background-color: #f97316; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 14px; display: inline-block;">
          Buka Percakapan Tiket
        </a>
      </div>
      <p style="color: #94a3b8; font-size: 12px; margin-top: 24px;">
        Anda menerima email ini karena terdaftar pada tiket dukungan teknis SaCMS.
      </p>
    </div>
  `

  const { client: resend, fromEmail } = await getResendClient()
  if (resend) {
    return resend.emails.send({
      from: fromEmail,
      to,
      subject: emailSubject,
      html,
    })
  }

  const t = await getTransporter()
  if (!t) {
    throw new Error("Layanan email belum dikonfigurasi di Super Admin Settings.")
  }
  const mailConfig = await getResolvedMailConfig()
  const info = await t.sendMail({
    from: mailConfig.smtpFrom || fromEmail || '"SaCMS Support" <support@sacms.local>',
    to,
    subject: emailSubject,
    html,
  })

  return info
}
