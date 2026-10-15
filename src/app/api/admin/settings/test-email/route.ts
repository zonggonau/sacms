import { NextResponse } from "next/server"
import nodemailer from "nodemailer"
import { Resend } from "resend"
import { withAdminAuth } from "@/lib/api/route-helpers"
import { isUnchangedSecretValue } from "@/lib/settings-secrets"
import { getResolvedMailConfig } from "@/lib/settings"
import { assertPublicHost, SsrfError } from "@/lib/safe-url"

export const POST = withAdminAuth(async (request, _context, { session }) => {
  try {
    const body = await request.json()
    let {
      targetEmail,
      resendApiKey,
      resendFrom,
      smtpHost,
      smtpPort,
      smtpSecure,
      smtpUser,
      smtpPass,
      smtpFrom
    } = body

    // The form sends the mask placeholder back when the admin hasn't
    // revealed/retyped the real secret — reading it literally (as this
    // route used to) sends "••••••••" to Resend/SMTP as the actual
    // credential, failing with a misleading auth error even though the
    // stored credential is valid. Resolve against the stored value instead,
    // same convention test-ai/route.ts already follows.
    if (typeof resendApiKey !== "string" || isUnchangedSecretValue(resendApiKey) || typeof smtpPass !== "string" || isUnchangedSecretValue(smtpPass)) {
      const stored = await getResolvedMailConfig()
      if (typeof resendApiKey !== "string" || isUnchangedSecretValue(resendApiKey)) resendApiKey = stored.resendApiKey
      if (typeof smtpPass !== "string" || isUnchangedSecretValue(smtpPass)) smtpPass = stored.smtpPass
    }

    const recipient = targetEmail || session.user.email
    if (!recipient) {
      return NextResponse.json({ success: false, message: "Email tujuan tidak boleh kosong." }, { status: 400 })
    }

    const subject = "🧪 Tes Pengiriman Email — SaCMS Platform"
    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
        <div style="margin-bottom: 16px; border-bottom: 2px solid #f97316; padding-bottom: 10px;">
          <span style="font-size: 20px; font-weight: 900; color: #0f172a;">Sa<span style="color: #f97316;">CMS</span> Platform</span>
        </div>
        <h3 style="color: #0f172a; margin-top: 0;">Uji Coba Pengiriman Email Berhasil! 🎉</h3>
        <p style="color: #475569; font-size: 14px; line-height: 1.6;">
          Konfigurasi pengiriman email di dashboard Super Admin SaCMS telah terhubung dan berfungsi dengan baik.
        </p>
        <div style="background: #f8fafc; padding: 12px 16px; border-radius: 8px; font-size: 12px; color: #64748b; margin-top: 16px;">
          Waktu pengujian: <strong>${new Date().toLocaleString("id-ID")}</strong>
        </div>
      </div>
    `

    // Test Resend first if key is provided
    if (resendApiKey) {
      try {
        const from = resendFrom || "SaCMS <noreply@mail.sacms.cloud>"
        const resend = new Resend(resendApiKey)
        const result = await resend.emails.send({
          from,
          to: recipient,
          subject,
          html,
        })
        if (result.error) {
          return NextResponse.json({ success: false, message: `Resend error: ${result.error.message}` }, { status: 400 })
        }
        return NextResponse.json({ success: true, message: `Email tes berhasil dikirim ke ${recipient} via Resend!` })
      } catch (err: any) {
        return NextResponse.json({ success: false, message: `Resend exception: ${err.message}` }, { status: 400 })
      }
    }

    // Test SMTP
    if (smtpHost && smtpPort) {
      try {
        // A real TCP connect + STARTTLS/auth attempt against an
        // admin-supplied host, with distinct error messages per failure
        // mode, is otherwise a ready-made internal-network port-scan oracle.
        await assertPublicHost(smtpHost)
        const transporter = nodemailer.createTransport({
          host: smtpHost,
          port: parseInt(smtpPort),
          secure: smtpSecure === "true" || parseInt(smtpPort) === 465,
          auth: smtpUser ? {
            user: smtpUser,
            pass: smtpPass,
          } : undefined,
        })

        await transporter.verify()
        await transporter.sendMail({
          from: smtpFrom || resendFrom || '"SaCMS" <noreply@mail.sacms.cloud>',
          to: recipient,
          subject,
          html,
        })

        return NextResponse.json({ success: true, message: `Email tes berhasil dikirim ke ${recipient} via SMTP (${smtpHost}:${smtpPort})!` })
      } catch (err: any) {
        if (err instanceof SsrfError) {
          return NextResponse.json({ success: false, message: "SMTP Host tidak valid: harus mengarah ke alamat publik, bukan alamat internal/privat." }, { status: 400 })
        }
        return NextResponse.json({ success: false, message: `SMTP error: ${err.message}` }, { status: 400 })
      }
    }

    return NextResponse.json({ success: false, message: "Harap masukkan Resend API Key atau konfigurasi SMTP Host & Port." }, { status: 400 })
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message || "Gagal menguji pengiriman email." }, { status: 500 })
  }
})
