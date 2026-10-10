/**
 * SaCMS — Backfill ApiKey.key from plaintext to a SHA-256 hash.
 *
 * ApiKey.key used to store the raw, directly-usable key value — a DB leak
 * meant every workspace's key was instantly reusable, no cracking needed,
 * unlike ApiToken.token (already hashed). Every lookup site now hashes the
 * incoming Bearer token and compares against ApiKey.key, so this backfill
 * re-hashes whatever's already stored in place.
 *
 * Idempotent: only rows still holding the old `sacms_<hex>` plaintext
 * format are touched — a 64-char hex SHA-256 hash never starts with
 * `sacms_`, so re-running this after a successful pass is a no-op.
 */
import { db } from "@/lib/database"
import { createHash } from "crypto"

async function main() {
  console.log("Scanning ApiKey rows for plaintext values to hash...")
  const keys = await db.apiKey.findMany({
    where: { key: { startsWith: "sacms_" } },
  })

  console.log(`Found ${keys.length} ApiKey row(s) still storing a plaintext key.`)
  for (const k of keys) {
    const hashed = createHash("sha256").update(k.key).digest("hex")
    await db.apiKey.update({
      where: { id: k.id },
      data: { key: hashed },
    })
    console.log(`Hashed ApiKey ${k.id} (tenant ${k.tenantId}, "${k.name}")`)
  }

  console.log("Backfill completed successfully.")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
