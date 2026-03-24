import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()

async function main() {
  console.log("🔄 Memperbaiki format harga di database...")

  const pricingCt = await prisma.contentType.findUnique({ where: { slug: "noken-pricing" } })
  if (!pricingCt) {
    console.error("❌ Content Type noken-pricing tidak ditemukan.")
    return
  }

  const entries = await prisma.contentEntry.findMany({
    where: { contentTypeId: pricingCt.id }
  })

  for (const entry of entries) {
    const data = typeof entry.data === 'string' ? JSON.parse(entry.data) : (entry.data as any)
    
    // Hapus titik lama jika ada, lalu pastikan formatnya benar
    let cleanPrice = data.price.toString().replace(/\./g, '')
    
    // Format ulang dengan titik setiap 3 digit
    let formattedPrice = cleanPrice.replace(/\B(?=(\d{3})+(?!\d))/g, ".")

    await prisma.contentEntry.update({
      where: { id: entry.id },
      data: {
        data: {
          ...data,
          price: formattedPrice
        }
      }
    })
    console.log(`✅ ${data.name}: ${data.price} -> ${formattedPrice}`)
  }

  console.log("✨ Perbaikan format selesai.")
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect())
