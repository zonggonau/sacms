/**
 * Rotate the platform `systemApiKey` setting.
 *
 * Usage:
 *   SYSTEM_API_KEY=<new-key> bun scripts/update-api-key.ts
 *   # or, to generate a fresh random one:
 *   bun scripts/update-api-key.ts
 *
 * The previous value was hardcoded here and leaked into version control —
 * it MUST be rotated on every environment.
 */
import { randomBytes } from "crypto"
import { PrismaClient } from "../prisma/generated-client"

const prisma = new PrismaClient()

async function main() {
  const value =
    process.env.SYSTEM_API_KEY?.trim() ||
    `sys_${randomBytes(32).toString("hex")}`

  await prisma.setting.upsert({
    where: { key: "systemApiKey" },
    update: { value },
    create: { key: "systemApiKey", value },
  })

  console.log("systemApiKey rotated.")
  if (!process.env.SYSTEM_API_KEY) {
    console.log("New key (store it now, it is not shown again):")
    console.log(value)
  }
}

main().finally(() => prisma.$disconnect())
