import { PrismaClient } from "../prisma/generated-client"

const prisma = new PrismaClient()

async function main() {
  console.log("🧹 Membersihkan ContentTypes lama yang sudah dipindah ke SingleType/Component...")
  const slugsToDelete = [
    "sacms-hero",
    "sacms-about",
    "sacms-whatsapp",
    "sacms-owners",
    "sacms-testimonials",
    "sacms-features",
    "sacms-workflow",
    "sacms-faq",
    "templates"
  ]

  const result = await prisma.contentType.deleteMany({
    where: {
      slug: {
        in: slugsToDelete
      }
    }
  })

  console.log(`✅ Berhasil menghapus ${result.count} ContentTypes lama (Collections).`)
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect())
