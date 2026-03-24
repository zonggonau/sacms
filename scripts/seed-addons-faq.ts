import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()

async function main() {
  console.log("🌱 Menambah data addons dan menyempurnakan seed...")

  const tenant = await prisma.tenant.findFirst()
  const addonCt = await prisma.contentType.findUnique({ where: { slug: "noken-addons" } })

  if (!tenant || !addonCt) {
    console.error("❌ Pastikan setup-noken-cms.ts sudah dijalankan sebelumnya.")
    return
  }

  // 1. Addons Data
  const addons = [
    { title: "Automated Backup", price_label: "Mulai 99rb/bln", description: "Backup data harian secara otomatis ke cloud storage terpisah.", icon: "RefreshCw" },
    { title: "Extended Storage", price_label: "Mulai 149rb/bln", description: "Tambah kapasitas penyimpanan media hingga terabyte.", icon: "HardDrive" },
    { title: "AI Content Pack", price_label: "Mulai 199rb/bln", description: "Token tambahan untuk generator konten AI tingkat lanjut.", icon: "BrainCircuit" },
  ]

  for (const a of addons) {
    await prisma.contentEntry.create({
      data: {
        contentTypeId: addonCt.id,
        tenantId: tenant.id,
        status: "PUBLISHED",
        data: a
      }
    })
  }

  // 2. FAQ Data (Jika belum ada)
  const faqCt = await prisma.contentType.findUnique({ where: { slug: "noken-faq" } })
  if (faqCt) {
    const faqs = [
      { question: "Apa itu Headless CMS?", answer: "Headless CMS adalah penyedia konten yang hanya menyediakan datanya melalui API, memisahkan konten dari tampilan (frontend), sehingga Anda bisa menampilkan konten tersebut di mana saja." },
      { question: "Apakah NokenStack buatan lokal?", answer: "Ya, NokenStack sepenuhnya dirancang dan dibangun oleh tim insinyur perangkat lunak dari Jayapura, Papua." },
      { question: "Bagaimana dengan keamanan data?", answer: "Kami menggunakan enkripsi tingkat tinggi dan audit log untuk memastikan setiap perubahan data terlacak dan aman." },
      { question: "Apakah ada dukungan untuk bahasa daerah?", answer: "AI Generator kami mendukung konteks lokal, termasuk kustomisasi untuk kebutuhan konten dalam bahasa daerah di Papua." },
    ]
    for (const f of faqs) {
      await prisma.contentEntry.create({
        data: { contentTypeId: faqCt.id, tenantId: tenant.id, status: "PUBLISHED", data: f }
      })
    }
  }

  console.log("✅ Seed data tambahan berhasil dimasukkan.")
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect())
