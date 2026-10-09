/**
 * Rotate the platform `systemApiKey` setting.
 *
 * Usage:
 *   SYSTEM_API_KEY=<new-key> bun scripts/core/update-api-key.ts
 *   # or, to generate a fresh random one:
 *   bun scripts/core/update-api-key.ts
 */
import { randomBytes } from "crypto"
import { db } from "@/lib/database"

export async function rotateSystemApiKey(customKey?: string) {
  const value =
    customKey ||
    process.env.SYSTEM_API_KEY?.trim() ||
    `sys_${randomBytes(32).toString("hex")}`

  await db.setting.upsert({
    where: { key: "systemApiKey" },
    update: { value },
    create: { key: "systemApiKey", value },
  })

  console.log("✅ systemApiKey rotated successfully.")
  if (!customKey && !process.env.SYSTEM_API_KEY) {
    console.log("New key (store it securely in environment):")
    console.log(value)
  }
  return value
}

if (import.meta.main) {
  rotateSystemApiKey()
    .catch((err) => {
      console.error("Failed to rotate API key:", err)
      process.exit(1)
    })
    .finally(async () => {
      await db.$disconnect()
    })
}
