import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()

async function main() {
  console.log("🚀 Setting up system settings...")

  // Ensure systemApiKey is set to "internal" for dashboard access
  const apiKey = await prisma.setting.upsert({
    where: { key: "systemApiKey" },
    update: { value: "internal" },
    create: { key: "systemApiKey", value: "internal" }
  })

  console.log("✅ systemApiKey set to 'internal'")
  console.log("✨ System settings setup complete!")
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect())
