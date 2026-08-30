import nodemailer from "nodemailer"
import { Resend } from "resend"

// Create a cached transporter so we don't recreate it on every API call in dev
let transporter: nodemailer.Transporter | null = null

// Initialize Resend
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

async function getTransporter() {
  if (transporter) return transporter

  if (process.env.SMTP_HOST && process.env.SMTP_PORT) {
    // Use real SMTP server
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT),
      secure: process.env.SMTP_SECURE === "true" || parseInt(process.env.SMTP_PORT) === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    })
  } else {
    // Generate test SMTP service account from ethereal.email
    // Only used for development/testing if no real SMTP is provided
    console.warn("No SMTP config found. Using Ethereal Email for testing...")
    const testAccount = await nodemailer.createTestAccount()
    
    transporter = nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      secure: false, // true for 465, false for other ports
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    })
  }

  return transporter
}

const getBaseUrl = () => {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return "http://localhost:3000"
}

export async function sendVerificationEmail(email: string, token: string, name: string = "User") {
  const verifyUrl = `${getBaseUrl()}/api/auth/verify?token=${token}`
  const subject = "Verify your email address - SaCMS"
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
      <h2 style="color: #0f172a;">Welcome to SaCMS!</h2>
      <p>Hi ${name},</p>
      <p>Please verify your email address by clicking the button below:</p>
      <div style="margin: 30px 0;">
        <a href="${verifyUrl}" style="background-color: #0f172a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Verify Email</a>
      </div>
      <p style="color: #64748b; font-size: 14px;">Or copy and paste this link in your browser:</p>
      <p style="word-break: break-all; color: #3b82f6; font-size: 14px;"><a href="${verifyUrl}">${verifyUrl}</a></p>
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
      <p style="color: #94a3b8; font-size: 12px;">If you didn't create an account, you can safely ignore this email.</p>
    </div>
  `

  if (resend) {
    return resend.emails.send({
      from: process.env.RESEND_FROM || "SaCMS <noreply@sacms.local>",
      to: email,
      subject,
      html,
    })
  }

  const t = await getTransporter()
  const info = await t.sendMail({
    from: process.env.SMTP_FROM || '"SaCMS" <noreply@sacms.local>',
    to: email,
    subject,
    html,
  })

  if (info.messageId && !process.env.SMTP_HOST) {
    console.log("=========================================")
    console.log("✉️  VERIFICATION EMAIL SENT TO ETHEREAL!")
    console.log("Preview URL: %s", nodemailer.getTestMessageUrl(info))
    console.log("=========================================")
  }

  return info
}

export async function sendPasswordResetEmail(email: string, token: string) {
  const resetUrl = `${getBaseUrl()}/reset-password?token=${token}`
  const subject = "Reset your password - SaCMS"
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
      <h2 style="color: #0f172a;">Password Reset Request</h2>
      <p>We received a request to reset your password for your SaCMS account.</p>
      <p>Click the button below to choose a new password:</p>
      <div style="margin: 30px 0;">
        <a href="${resetUrl}" style="background-color: #0f172a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Reset Password</a>
      </div>
      <p style="color: #64748b; font-size: 14px;">Or copy and paste this link in your browser:</p>
      <p style="word-break: break-all; color: #3b82f6; font-size: 14px;"><a href="${resetUrl}">${resetUrl}</a></p>
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
      <p style="color: #94a3b8; font-size: 12px;">If you didn't request a password reset, you can safely ignore this email.</p>
    </div>
  `

  if (resend) {
    return resend.emails.send({
      from: process.env.RESEND_FROM || "SaCMS <noreply@sacms.local>",
      to: email,
      subject,
      html,
    })
  }

  const t = await getTransporter()
  const info = await t.sendMail({
    from: process.env.SMTP_FROM || '"SaCMS" <noreply@sacms.local>',
    to: email,
    subject,
    html,
  })

  if (info.messageId && !process.env.SMTP_HOST) {
    console.log("=========================================")
    console.log("✉️  PASSWORD RESET EMAIL SENT TO ETHEREAL!")
    console.log("Preview URL: %s", nodemailer.getTestMessageUrl(info))
    console.log("=========================================")
  }

  return info
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

  if (resend) {
    return resend.emails.send({
      from: process.env.RESEND_FROM || "SaCMS Support <support@sacms.local>",
      to,
      subject: emailSubject,
      html,
    })
  }

  const t = await getTransporter()
  const info = await t.sendMail({
    from: process.env.SMTP_FROM || '"SaCMS Support" <support@sacms.local>',
    to,
    subject: emailSubject,
    html,
  })

  return info
}

