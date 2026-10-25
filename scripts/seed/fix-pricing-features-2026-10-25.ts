/**
 * One-time data fix: seed-pricing-catalog.ts is create-only-if-missing by
 * design (so admin edits are never overwritten by a later deploy), which
 * means production's original WorkspacePlan rows never got the 2026-10-25
 * realism correction (removed fabricated bandwidth/CDN/free-domain claims,
 * fixed the AI-credits-are-account-not-workspace-level mismatch) — that fix
 * only ever reached the local dev DB.
 *
 * This script applies the same corrected `features` copy directly via
 * UPDATE, scoped to exactly the 3 known slugs (free/pro/business) and only
 * the `features` column — every other field (prices, limits) is untouched.
 * Idempotent: running it again just re-sets the same values.
 *
 * Wired into .github/workflows/ci.yml's deploy step for one deploy only;
 * remove that wiring (not this file) once confirmed applied in production.
 */
import { db } from "@/lib/database"

const FEATURES: Record<string, string[]> = {
  free: [
    "Unlimited Content Schemas & Tipe Data",
    "500 Entri Konten Dinamis",
    "1 Anggota Tim",
    "100 MB Cloud Storage",
    "1.000 API Calls / bulan",
    "REST & GraphQL API",
    "Community Support",
  ],
  pro: [
    "10.000 Entri Konten & Unlimited Schemas",
    "10 Anggota Tim & Kolaborasi Multi-Role (RBAC)",
    "5 GB Cloud Storage Media Assets",
    "100.000 API Requests / bulan",
    "5 Bahasa (Locale) Konten",
    "Hubungkan Domain Kustom Sendiri + SSL HTTPS Otomatis",
    "Prioritas Support",
  ],
  business: [
    "50.000 Entri Konten & Unlimited Schemas",
    "25 Anggota Tim & Sequential Review Workflow",
    "10 GB Cloud Storage Media Assets",
    "1.000.000 API Requests / bulan",
    "10 Bahasa (Locale) Konten",
    "Hubungkan Domain Kustom Sendiri + SSL HTTPS Otomatis",
    "Custom SMTP Mail Transporter Sendiri",
    "Audit Log Aktivitas Lengkap",
    "Prioritas Support",
  ],
}

async function main() {
  console.log("Fixing production WorkspacePlan features copy (2026-10-25 realism correction)...")
  for (const [slug, features] of Object.entries(FEATURES)) {
    const existing = await db.workspacePlan.findUnique({ where: { slug } })
    if (!existing) {
      console.log(`  [skip] "${slug}" not found`)
      continue
    }
    await db.workspacePlan.update({ where: { slug }, data: { features } })
    console.log(`  [fixed] "${slug}" features updated`)
  }
  console.log("Done.")
}

if (import.meta.main) {
  main()
    .catch((e) => {
      console.error(e)
      process.exit(1)
    })
    .finally(async () => {
      await db.$disconnect()
    })
}
