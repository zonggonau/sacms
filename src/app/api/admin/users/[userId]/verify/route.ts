import { NextResponse } from "next/server"
import { db } from "@/lib/database"
import { sendVerificationEmail } from "@/lib/mail"
import { isMailConfigured } from "@/lib/settings"
import { logAudit } from "@/lib/audit-log"
import crypto from "crypto"
import { withAdminAuth } from "@/lib/api/route-helpers"

export const POST = withAdminAuth(
  async (request, context, { session }) => {
    const { userId } = await context.params
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

    // Same guard PATCH/DELETE already enforce on this user: a plain admin
    // touching a super_admin's verification status is exactly how a
    // lower-privileged account could lock every super_admin out of
    // password login (credential login is blocked while emailVerified is
    // null — see src/lib/auth.ts) despite having no business doing so.
    if (user.role === "super_admin" && session.user.role !== "super_admin") {
      return NextResponse.json({ error: "Only a super admin can change a super admin's verification status" }, { status: 403 })
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
        userId: session.user.id,
        entity: "user",
        entityId: user.id,
        data: { actorEmail: session.user.email || "superadmin", method: "admin_manual_verify", userEmail: user.email },
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
        userId: session.user.id,
        entity: "user",
        entityId: user.id,
        data: { actorEmail: session.user.email || "superadmin", method: "admin_revoke_verify", userEmail: user.email },
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
        userId: session.user.id,
        entity: "user",
        entityId: user.id,
        data: { actorEmail: session.user.email || "superadmin", userEmail: user.email, tokenExpiryHours: 24 },
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
  },
)
