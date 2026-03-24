import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()

async function main() {
  console.log("🔄 Memperbarui subjudul Noken Hero...")

  const heroCt = await prisma.contentType.findUnique({ where: { slug: "noken-hero" } })
  if (!heroCt) {
    console.error("❌ Content Type noken-hero tidak ditemukan.")
    return
  }

  const heroEntry = await prisma.contentEntry.findFirst({
    where: { contentTypeId: heroCt.id }
  })

  if (!heroEntry) {
    console.error("❌ Entri hero tidak ditemukan.")
    return
  }

  const currentData = typeof heroEntry.data === 'string' ? JSON.parse(heroEntry.data) : (heroEntry.data as any)
  
  const newData = {
    ...currentData,
    subtitle: "NokenStack adalah Headless CMS berperforma tinggi yang dirancang khusus oleh Engineer Papua. Solusi modern untuk skalabilitas, keamanan, dan transformasi digital instansi atau Website di Tanah Papua."
  }

  await prisma.contentEntry.update({
    where: { id: heroEntry.id },
    data: {
      data: newData
    }
  })

  console.log("✅ Subjudul berhasil diperbarui.")
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect())
