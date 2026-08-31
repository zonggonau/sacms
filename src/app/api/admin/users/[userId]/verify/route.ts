import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/database"
import { sendVerificationEmail } from "@/lib/mail"
import { isMailConfigured } from "@/lib/settings"
import { logAudit } from "@/lib/audit-log"
import crypto from "crypto"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (session?.user?.role !== "super_admin" && session?.user?.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { userId } = await params
    const body = await request.json().catch(() => ({}))
    const action = body.action || "send_email" // "send_email" | "manual_verify" | "revoke_verify"

    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        emailVerified: true,
      },
    })

    if (!user) {
      return NextResponse.json({ error: "User tidak ditemukan" }, { status: 404 })
    }

    // 1. Manual Verification by Super Admin
    if (action === "manual_verify") {
      await db.user.update({
        where: { id: user.id },
        data: { emailVerified: new Date() },
      })

      // Clean up any pending verification tokens
      await db.verificationToken.deleteMany({
        where: { identifier: user.email },
      })

      await logAudit({
        action: "auth.verify",
        actorId: session.user.id,
        actorEmail: session.user.email || "superadmin",
        targetId: user.id,
        targetType: "user",
        details: { method: "admin_manual_verify", userEmail: user.email },
      })

      return NextResponse.json({
        success: true,
        message: `Akun ${user.email} berhasil diverifikasi secara manual oleh Super Admin.`,
      })
    }

    // 2. Revoke Verification
    if (action === "revoke_verify") {
      await db.user.update({
        where: { id: user.id },
        data: { emailVerified: null },
      })

      await logAudit({
        action: "auth.unverify",
        actorId: session.user.id,
        actorEmail: session.user.email || "superadmin",
        targetId: user.id,
        targetType: "user",
        details: { method: "admin_revoke_verify", userEmail: user.email },
      })

      return NextResponse.json({
        success: true,
        message: `Status verifikasi akun ${user.email} berhasil dicabut.`,
      })
    }

    // 3. Send Verification Email with Fresh Token
    const hasMailService = await isMailConfigured()
    if (!hasMailService) {
      return NextResponse.json({
        error: "Layanan email (Resend atau SMTP) belum dikonfigurasi. Silakan atur konfigurasi email di menu Settings > Email / SMTP terlebih dahulu.",
      }, { status: 400 })
    }

    // Generate fresh verification token valid for 24 hours
    const token = crypto.randomBytes(32).toString("hex")
    const expires = new Date()
    expires.setHours(expires.getHours() + 24)

    // Remove previous pending tokens
    await db.verificationToken.deleteMany({
      where: { identifier: user.email },
    })

    await db.verificationToken.create({
      data: {
        identifier: user.email,
        token,
        expires,
      },
    })

    try {
      await sendVerificationEmail(user.email, token, user.name || "User")

      await logAudit({
        action: "auth.send_verification",
        actorId: session.user.id,
        actorEmail: session.user.email || "superadmin",
        targetId: user.id,
        targetType: "user",
        details: { userEmail: user.email, tokenExpiryHours: 24 },
      })

      return NextResponse.json({
        success: true,
        message: `Tautan aktivasi email berhasil dikirim ke ${user.email} (berlaku selama 24 jam).`,
      })
    } catch (mailErr: any) {
      console.error("[Admin Users] Failed to send verification email:", mailErr)
      return NextResponse.json({
        error: `Gagal mengirim email: ${mailErr?.message || "Kesalahan server email"}`,
      }, { status: 500 })
    }
  } catch (error: any) {
    console.error("[Admin Users] Error in verify route:", error)
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 })
  }
}
