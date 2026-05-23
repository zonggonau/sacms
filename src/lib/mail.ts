import nodemailer from "nodemailer"

// Create a cached transporter so we don't recreate it on every API call in dev
let transporter: nodemailer.Transporter | null = null

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
  const t = await getTransporter()
  const verifyUrl = `${getBaseUrl()}/api/auth/verify?token=${token}`

  const info = await t.sendMail({
    from: process.env.SMTP_FROM || '"SaCMS" <noreply@sacms.local>',
    to: email,
    subject: "Verify your email address - SaCMS",
    text: `Hi ${name},\n\nPlease verify your email by clicking the following link:\n${verifyUrl}\n\nIf you did not request this, please ignore this email.`,
    html: `
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
    `,
  })

  // If using ethereal, log the preview URL
  if (info.messageId && !process.env.SMTP_HOST) {
    console.log("=========================================")
    console.log("✉️  VERIFICATION EMAIL SENT TO ETHEREAL!")
    console.log("Preview URL: %s", nodemailer.getTestMessageUrl(info))
    console.log("=========================================")
  }

  return info
}

export async function sendPasswordResetEmail(email: string, token: string) {
  const t = await getTransporter()
  const resetUrl = `${getBaseUrl()}/reset-password?token=${token}`

  const info = await t.sendMail({
    from: process.env.SMTP_FROM || '"SaCMS" <noreply@sacms.local>',
    to: email,
    subject: "Reset your password - SaCMS",
    text: `You requested a password reset.\n\nPlease reset your password by clicking the following link:\n${resetUrl}\n\nIf you did not request this, please ignore this email.`,
    html: `
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
    `,
  })

  // If using ethereal, log the preview URL
  if (info.messageId && !process.env.SMTP_HOST) {
    console.log("=========================================")
    console.log("✉️  PASSWORD RESET EMAIL SENT TO ETHEREAL!")
    console.log("Preview URL: %s", nodemailer.getTestMessageUrl(info))
    console.log("=========================================")
  }

  return info
}
