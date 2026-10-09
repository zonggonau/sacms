import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()

async function main() {
  // 1. Hapus Landing Page milik Startup (Papua)
  const deletedStartup = await prisma.contentType.deleteMany({
    where: { slug: "landing-page" }
  })
  
  // 2. Hapus Platform Landing Page (Global)
  const deletedGlobal = await prisma.contentType.deleteMany({
    where: { slug: "platform-landing-page" }
  })

  console.log(`Successfully deleted ${deletedStartup.count} startup landing pages.`)
  console.log(`Successfully deleted ${deletedGlobal.count} global landing pages.`)
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect())
