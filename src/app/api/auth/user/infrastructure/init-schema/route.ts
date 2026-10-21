import { execSync } from "child_process"
import path from "path"
import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/database"
import { hasAccountLicense } from "@/lib/account-license"
import { isPlatformStaff } from "@/lib/platform-roles"
import { logAudit, AuditAction } from "@/lib/audit-log"
import { rateLimit } from "@/lib/rate-limit"

/**
 * POST /api/auth/user/infrastructure/init-schema
 *
 * One-time step after saving a master database connection: a brand-new
 * Postgres database has no tables yet, and nothing else in the app ever
 * creates them (see push-tenant-schema.ts, previously a staff-only CLI
 * script this mirrors). Without this, every query against a fresh BYODB
 * connection fails with "relation does not exist" the moment it's used.
 *
 * Runs `prisma db push` from the already-running app server against the
 * SAVED masterDatabaseUrl — deliberately WITHOUT --accept-data-loss, so
 * Prisma's own built-in protection refuses (instead of silently destroying
 * data) if the target database already holds an incompatible schema. Safe
 * to call again later: pushing an already-matching schema is a no-op.
 */
export async function POST(_req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (isPlatformStaff(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const rl = await rateLimit(`infra-init-schema:${session.user.id}`, { limit: 5, windowSeconds: 300 })
  if (!rl.success) {
    return NextResponse.json({ error: "Terlalu banyak percobaan. Coba lagi beberapa menit." }, { status: 429 })
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { plan: true, masterDatabaseUrl: true },
  })
  if (!(await hasAccountLicense(session.user.id, user?.plan))) {
    return NextResponse.json({ error: "Forbidden: requires an Enterprise License" }, { status: 403 })
  }
  if (!user?.masterDatabaseUrl) {
    return NextResponse.json({ error: "Simpan koneksi database terlebih dahulu sebelum inisialisasi skema." }, { status: 400 })
  }

  const schemaPath = path.resolve(process.cwd(), "prisma", "schema.prisma")

  try {
    execSync(`bun x prisma db push --skip-generate --schema="${schemaPath}"`, {
      env: { ...process.env, DATABASE_URL: user.masterDatabaseUrl },
      timeout: 60_000,
      stdio: "pipe",
    })
  } catch (error: any) {
    const output = String(error?.stdout || "") + String(error?.stderr || "")
    console.error("[InitSchema] prisma db push failed:", output || error)
    const dataLoss = /data loss|destructive/i.test(output)
    return NextResponse.json(
      {
        error: dataLoss
          ? "Inisialisasi dibatalkan karena berisiko menghapus data — database ini sepertinya sudah berisi data lain. Hubungi tim SaCMS untuk migrasi yang aman."
          : "Gagal menginisialisasi skema database. Pastikan koneksi masih aktif dan database bisa menerima perubahan skema, atau hubungi tim SaCMS.",
      },
      { status: 400 },
    )
  }

  logAudit({
    userId: session.user.id,
    action: AuditAction.SETTINGS_UPDATED,
    entity: "UserMasterInfraSchemaInit",
    data: {},
  })

  return NextResponse.json({ success: true })
}
