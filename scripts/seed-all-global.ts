/**
 * ═══════════════════════════════════════════════════════════════
 * SaCMS Global Seed — Papua Digital
 * ═══════════════════════════════════════════════════════════════
 * Script ini SELF-CONTAINED. Jalankan sekali untuk:
 * 1. Membuat Content Types & Single Types (jika belum ada)
 * 2. Mengisi semua data landing page (Hero → Footer)
 * 
 * Usage: npx tsx scripts/seed-all-global.ts
 * ═══════════════════════════════════════════════════════════════
 */

import { PrismaClient } from "../prisma/generated-client"
const prisma = new PrismaClient()

// ──────────────────────────────────────────────────────────
// SCHEMA DEFINITIONS (Content Types + Single Types)
// ──────────────────────────────────────────────────────────
const CONTENT_TYPES = [
  {
    slug: "sacms-hero",
    name: "SaCMS Hero Section",
    description: "Hero banner untuk halaman depan",
    isSingleType: false,
    fields: [
      { slug: "headline",      name: "Headline",      type: "text",   required: true,  order: 0 },
      { slug: "subheadline",   name: "Subheadline",   type: "text",   required: false, order: 1 },
      { slug: "cta_primary",   name: "CTA Primary",   type: "text",   required: false, order: 2 },
      { slug: "cta_secondary", name: "CTA Secondary", type: "text",   required: false, order: 3 },
      { slug: "badge_text",    name: "Badge Text",    type: "text",   required: false, order: 4 },
      { slug: "image_url",     name: "Image URL",     type: "text",   required: false, order: 5 },
    ],
  },
  {
    slug: "sacms-features",
    name: "SaCMS Features",
    description: "Kartu fitur di halaman depan",
    isSingleType: false,
    fields: [
      { slug: "icon",        name: "Icon",        type: "text", required: false, order: 0 },
      { slug: "title",       name: "Title",       type: "text", required: true,  order: 1 },
      { slug: "description", name: "Description", type: "text", required: false, order: 2 },
      { slug: "color",       name: "Color",       type: "text", required: false, order: 3 },
    ],
  },
  {
    slug: "sacms-addons",
    name: "SaCMS Addons",
    description: "Layanan tambahan opsional",
    isSingleType: false,
    fields: [
      { slug: "icon",        name: "Icon",        type: "text",   required: false, order: 0 },
      { slug: "name",        name: "Name",        type: "text",   required: true,  order: 1 },
      { slug: "description", name: "Description", type: "text",   required: false, order: 2 },
      { slug: "price",       name: "Price",       type: "number", required: false, order: 3 },
      { slug: "unit",        name: "Unit",        type: "text",   required: false, order: 4 },
    ],
  },
  {
    slug: "sacms-workflow",
    name: "SaCMS Workflow Steps",
    description: "Langkah-langkah cara kerja",
    isSingleType: false,
    fields: [
      { slug: "step",        name: "Step Number", type: "number", required: true,  order: 0 },
      { slug: "title",       name: "Title",       type: "text",   required: true,  order: 1 },
      { slug: "description", name: "Description", type: "text",   required: false, order: 2 },
      { slug: "icon",        name: "Icon",        type: "text",   required: false, order: 3 },
    ],
  },
  {
    slug: "sacms-faq",
    name: "SaCMS FAQ",
    description: "Pertanyaan yang sering diajukan",
    isSingleType: false,
    fields: [
      { slug: "question", name: "Question", type: "text",   required: true,  order: 0 },
      { slug: "answer",   name: "Answer",   type: "text",   required: true,  order: 1 },
      { slug: "order",    name: "Order",    type: "number", required: false, order: 2 },
    ],
  },
  {
    slug: "sacms-testimonials",
    name: "SaCMS Testimonials",
    description: "Testimoni pengguna",
    isSingleType: false,
    fields: [
      { slug: "name",       name: "Name",       type: "text",   required: true,  order: 0 },
      { slug: "role",       name: "Role",       type: "text",   required: false, order: 1 },
      { slug: "company",    name: "Company",    type: "text",   required: false, order: 2 },
      { slug: "content",    name: "Content",    type: "text",   required: true,  order: 3 },
      { slug: "avatar_url", name: "Avatar URL", type: "text",   required: false, order: 4 },
      { slug: "rating",     name: "Rating",     type: "number", required: false, order: 5 },
    ],
  },
  {
    slug: "sacms-owners",
    name: "SaCMS Team/Owners",
    description: "Profil anggota tim",
    isSingleType: false,
    fields: [
      { slug: "name",       name: "Name",       type: "text", required: true,  order: 0 },
      { slug: "role",       name: "Role",       type: "text", required: false, order: 1 },
      { slug: "bio",        name: "Bio",        type: "text", required: false, order: 2 },
      { slug: "avatar_url", name: "Avatar URL", type: "text", required: false, order: 3 },
      { slug: "linkedin",   name: "LinkedIn",   type: "text", required: false, order: 4 },
    ],
  },
  {
    slug: "sacms-about",
    name: "SaCMS About Section",
    description: "Konten section tentang kami (single)",
    isSingleType: false,
    fields: [
      { slug: "title",       name: "Title",       type: "text", required: true,  order: 0 },
      { slug: "description", name: "Description", type: "text", required: false, order: 1 },
      { slug: "mission",     name: "Mission",     type: "text", required: false, order: 2 },
      { slug: "founded",     name: "Founded",     type: "text", required: false, order: 3 },
    ],
  },
  {
    slug: "sacms-whatsapp",
    name: "SaCMS WhatsApp Config",
    description: "Konfigurasi tombol WhatsApp (single)",
    isSingleType: false,
    fields: [
      { slug: "phone",     name: "Phone",     type: "text",    required: true,  order: 0 },
      { slug: "message",   name: "Message",   type: "text",    required: false, order: 1 },
      { slug: "label",     name: "Label",     type: "text",    required: false, order: 2 },
      { slug: "is_active", name: "Is Active", type: "boolean", required: false, order: 3 },
    ],
  },
  {
    slug: "sacms-sectors",
    name: "SaCMS Sectors",
    description: "Sektor yang dilayani",
    isSingleType: false,
    fields: [
      { slug: "icon",  name: "Icon",  type: "text", required: true, order: 0 },
      { slug: "label", name: "Label", type: "text", required: true, order: 1 },
      { slug: "desc",  name: "Description", type: "text", required: false, order: 2 },
    ]
  },
  {
    slug: "sacms-local-pride",
    name: "SaCMS Local Pride",
    description: "Section kebanggaan lokal",
    isSingleType: false,
    fields: [
      { slug: "badge", name: "Badge Text", type: "text", required: false, order: 0 },
      { slug: "title", name: "Title", type: "text", required: true, order: 1 },
      { slug: "description", name: "Description", type: "textarea", required: false, order: 2 },
    ]
  },
  {
    slug: "sacms-cta",
    name: "SaCMS CTA Banner",
    description: "Call to Action di bagian bawah",
    isSingleType: false,
    fields: [
      { slug: "title", name: "Title", type: "text", required: true, order: 0 },
      { slug: "description", name: "Description", type: "text", required: false, order: 1 },
      { slug: "button_primary_text", name: "Primary Button Text", type: "text", required: false, order: 2 },
      { slug: "button_secondary_text", name: "Secondary Button Text", type: "text", required: false, order: 3 },
    ]
  },
  {
    slug: "sacms-footer",
    name: "SaCMS Footer",
    description: "Konfigurasi Footer",
    isSingleType: false,
    fields: [
      { slug: "brand_name", name: "Brand Name", type: "text", required: true, order: 0 },
      { slug: "description", name: "Description", type: "text", required: false, order: 1 },
      { slug: "copyright", name: "Copyright Text", type: "text", required: false, order: 2 },
    ]
  }
]

// ──────────────────────────────────────────────────────────
// SEED DATA — Semua konten landing page Papua Digital
// ──────────────────────────────────────────────────────────
const SEED_DATA: Record<string, object | object[]> = {

  // ───── HERO (Single Type) ─────
  "sacms-hero": {
    headline: "Modernisasi Digital untuk Tanah Papua",
    subheadline: "Platform CMS modern untuk membangun website pemerintah, portal berita, katalog UMKM, dan pariwisata di Papua. Dibangun dengan teknologi enterprise-grade untuk mendukung percepatan transformasi digital di Tanah Papua.",
    cta_primary: "Mulai Sekarang",
    cta_secondary: "Pelajari Selengkapnya",
    badge_text: "🏛️ Platform Digital Papua — Khusus Website Pemerintah",
    image_url: ""
  },

  // ───── FEATURES (Collection) ─────
  "sacms-features": [
    { icon: "Shield",     title: "Website Pemerintah",       description: "Template dan sistem siap pakai untuk instansi pemerintah daerah di Papua. Mendukung transparansi informasi publik, pengumuman resmi, dan layanan masyarakat secara digital.", color: "indigo" },
    { icon: "Zap",        title: "Portal Berita & Blog",     description: "Sistem publikasi berita dan blog profesional untuk media lokal Papua. Dilengkapi kategori, penulis, penjadwalan publikasi, dan SEO otomatis.", color: "blue" },
    { icon: "Layout",     title: "Katalog UMKM & Produk",    description: "Etalase digital untuk wirausaha dan UMKM Papua. Tampilkan produk lokal, harga, dan informasi usaha kepada pasar yang lebih luas.", color: "purple" },
    { icon: "Globe",      title: "Pariwisata Papua",         description: "Showcase destinasi wisata dan kekayaan budaya Papua — dari Raja Ampat hingga Lembah Baliem. Website wisata yang memukau untuk menarik wisatawan.", color: "teal" },
    { icon: "CreditCard", title: "Profil Bisnis & Cafe",     description: "Website profesional untuk usaha kecil dan menengah: cafe, restoran, toko, dan layanan jasa di seluruh Papua. Tampil modern dan mudah dikelola.", color: "yellow" },
    { icon: "Database",   title: "Keamanan & Keandalan",     description: "Infrastruktur enterprise-grade dengan enkripsi data, kontrol akses berbasis peran (RBAC), audit log, dan backup otomatis. Aman untuk data pemerintah dan bisnis.", color: "slate" },
  ],

  // ───── WORKFLOW (Collection) ─────
  "sacms-workflow": [
    { step: 1, title: "Pilih Template",      description: "Pilih template sesuai kebutuhan — Website Pemerintah, Portal Berita, Katalog UMKM, atau Pariwisata. Siap pakai dalam hitungan menit.", icon: "PenLine" },
    { step: 2, title: "Sesuaikan Konten",     description: "Isi data instansi, upload logo dan foto, atur tampilan website. Dashboard CMS yang mudah digunakan siapa saja.", icon: "FileEdit" },
    { step: 3, title: "Kelola & Kolaborasi",  description: "Undang tim untuk mengelola konten bersama. Sistem approval, penjadwalan publikasi, dan audit log bawaan.", icon: "Code2" },
    { step: 4, title: "Publikasikan",         description: "Website siap online dan bisa diakses masyarakat Papua dan dunia. Performa cepat, aman, dan andal.", icon: "Rocket" },
  ],

  // ───── FAQ (Collection) ─────
  "sacms-faq": [
    { question: "Apakah SaCMS cocok untuk website pemerintah daerah?", answer: "Sangat cocok! SaCMS dirancang khusus dengan fitur keamanan enterprise-grade, kontrol akses berbasis peran, dan audit log yang memenuhi standar website pemerintah Indonesia.", order: 1 },
    { question: "Apakah ada paket gratis untuk UMKM?", answer: "Ya! Paket Gratis tersedia selamanya tanpa biaya dan tanpa kartu kredit. UMKM di Papua bisa langsung memulai dan upgrade ketika bisnis berkembang.", order: 2 },
    { question: "Apakah mendukung bahasa daerah Papua?", answer: "Ya, SaCMS mendukung multi-bahasa penuh. Anda bisa menambahkan bahasa Indonesia, bahasa daerah Papua, dan bahasa lainnya untuk menjangkau semua kalangan masyarakat.", order: 3 },
    { question: "Metode pembayaran apa saja yang didukung?", answer: "Kami menggunakan Midtrans yang mendukung transfer bank, kartu kredit, GoPay, OVO, DANA, dan banyak metode pembayaran Indonesia lainnya.", order: 4 },
    { question: "Apakah data aman untuk instansi pemerintah?", answer: "Keamanan data adalah prioritas utama. SaCMS menggunakan enkripsi end-to-end, isolasi data per workspace, backup otomatis, dan infrastruktur cloud yang tersertifikasi.", order: 5 },
    { question: "Bisa digunakan untuk website pariwisata?", answer: "Tentu! SaCMS sangat cocok untuk website pariwisata dengan fitur galeri foto, peta lokasi, katalog destinasi, dan integrasi media sosial untuk mempromosikan keindahan Papua.", order: 6 },
  ],

  // ───── ADDONS (Collection) ─────
  "sacms-addons": [
    { icon: "Bot",      name: "Paket AI Konten",     description: "10.000 kredit tambahan untuk pembuatan konten otomatis dengan AI per bulan.", price: 49000, unit: "bulan" },
    { icon: "Database", name: "Penyimpanan Ekstra",   description: "50GB tambahan penyimpanan untuk media, dokumen, dan aset digital.",           price: 29000, unit: "bulan" },
    { icon: "Zap",      name: "Boost API",            description: "500.000 request API tambahan per bulan untuk website dengan trafik tinggi.",   price: 39000, unit: "bulan" },
    { icon: "Shield",   name: "Konsultasi Digital",   description: "Konsultasi bulanan untuk strategi digitalisasi instansi dan UMKM di Papua.",   price: 99000, unit: "bulan" },
  ],

  // ───── TESTIMONIALS (Collection) ─────
  "sacms-testimonials": [
    {
      name: "Yohanes Wenda",
      role: "Kepala Bidang TIK",
      company: "Dinas Kominfo Papua",
      content: "SaCMS membantu kami membangun portal informasi pemerintah yang modern dan mudah dikelola. Transparansi informasi publik jadi lebih baik.",
      avatar_url: "https://api.dicebear.com/7.x/avataaars/svg?seed=Yohanes",
      rating: 5
    },
    {
      name: "Maria Rumbekwan",
      role: "Pemilik UMKM",
      company: "Noken Papua Store",
      content: "Berkat SaCMS, produk kerajinan noken kami sekarang bisa dilihat dan dipesan dari seluruh Indonesia. Omzet naik 3x lipat!",
      avatar_url: "https://api.dicebear.com/7.x/avataaars/svg?seed=Maria",
      rating: 5
    },
    {
      name: "Daniel Fatem",
      role: "Pengelola Pariwisata",
      company: "Raja Ampat Tourism",
      content: "Website pariwisata kami tampil profesional dan memukau. Jumlah wisatawan yang menghubungi kami meningkat drastis sejak menggunakan SaCMS.",
      avatar_url: "https://api.dicebear.com/7.x/avataaars/svg?seed=Daniel",
      rating: 5
    },
  ],

  // ───── OWNERS / TIM (Collection) ─────
  "sacms-owners": [
    {
      name: "Zonggonau Cristoper",
      role: "Founder & Lead Architect",
      bio: "Seorang pengembang perangkat lunak yang berdedikasi untuk membangun ekosistem teknologi digital di Papua. Berpengalaman dalam merancang sistem skala besar yang efisien dan aman.",
      avatar_url: "https://api.dicebear.com/7.x/avataaars/svg?seed=Cristoper",
      linkedin: "https://linkedin.com/in/cristoperz"
    },
    {
      name: "Januar Fonda",
      role: "Core Developer",
      bio: "Pengembang Fullstack yang fokus pada performa dan skalabilitas sistem. Berkomitmen untuk menghadirkan pengalaman pengguna terbaik melalui teknologi modern.",
      avatar_url: "https://api.dicebear.com/7.x/avataaars/svg?seed=Januar",
      linkedin: ""
    },
  ],

  // ───── ABOUT (Single Type) ─────
  "sacms-about": {
    title: "Tentang SaCMS",
    description: "SaCMS adalah platform CMS modern yang lahir dari visi untuk mempercepat transformasi digital di Tanah Papua. Kami membangun teknologi website yang mudah digunakan untuk instansi pemerintah, UMKM, media, dan sektor pariwisata di seluruh Papua.",
    mission: "Mewujudkan Papua Digital — membawa infrastruktur teknologi informasi kelas dunia untuk mendukung kemajuan pemerintahan, ekonomi, dan pariwisata di Tanah Papua.",
    founded: "2024"
  },

  // ───── WHATSAPP CONFIG (Single Type) ─────
  "sacms-whatsapp": {
    phone: "6282199220551",
    message: "Halo! Saya tertarik membangun website untuk instansi/UMKM di Papua menggunakan SaCMS. Bisakah saya mendapatkan informasi lebih lanjut?",
    label: "Hubungi Kami",
    is_active: true
  },

  // ───── SECTORS (Collection) ─────
  "sacms-sectors": [
    { icon: "Landmark", label: "Website Pemerintah", desc: "Portal resmi instansi" },
    { icon: "ShoppingBag", label: "UMKM & Wirausaha", desc: "Etalase produk digital" },
    { icon: "Palmtree", label: "Pariwisata", desc: "Destinasi & budaya" },
    { icon: "Newspaper", label: "Portal Berita", desc: "Media & blog" },
    { icon: "Coffee", label: "Cafe & Restoran", desc: "Profil usaha kuliner" },
    { icon: "Package", label: "Katalog Produk", desc: "Showcase produk" },
    { icon: "Building2", label: "Perusahaan", desc: "Company profile" },
    { icon: "Lightbulb", label: "Startup & Inovasi", desc: "Ekosistem digital" },
  ],

  // ───── LOCAL PRIDE (Single Type) ─────
  "sacms-local-pride": {
    badge: "Kebanggaan Lokal",
    title: "Dibuat di Papua.<br/>Untuk Kemajuan Papua.",
    description: "SaCMS lahir dari visi bahwa inovasi teknologi kelas dunia bisa dibangun dari Timur Indonesia. Kami membangun infrastruktur digital enterprise-grade untuk mendukung percepatan transformasi digital di seluruh Tanah Papua — dari pemerintahan hingga UMKM.",
  },

  // ───── CTA BANNER (Single Type) ─────
  "sacms-cta": {
    title: "Siap Membangun Website untuk Papua?",
    description: "Mulai gratis sekarang. Tanpa kartu kredit. Upgrade kapan saja sesuai kebutuhan.",
    button_primary_text: "Mulai Gratis Sekarang",
    button_secondary_text: "Baca Dokumentasi",
  },

  // ───── FOOTER (Single Type) ─────
  "sacms-footer": {
    brand_name: "SaCMS",
    description: "Platform CMS Modern untuk Papua Digital.",
    copyright: "SaCMS. Hak cipta dilindungi.",
  },
}

// ──────────────────────────────────────────────────────────
// MAIN FUNCTION
// ──────────────────────────────────────────────────────────
async function main() {
  console.log("══════════════════════════════════════════════════")
  console.log("🌱 SaCMS Global Seed — Papua Digital")
  console.log("══════════════════════════════════════════════════\n")

  // ─── STEP 1: Ensure schemas exist (Content Types + Single Types) ───
  console.log("📐 STEP 1: Memastikan semua Content Types & Single Types tersedia...\n")

  for (const ct of CONTENT_TYPES) {
    if (ct.isSingleType) {
      // ── Single Type ──
      let singleType = await prisma.singleType.findFirst({
        where: { slug: ct.slug, tenantId: null },
      })

      if (!singleType) {
        singleType = await prisma.singleType.create({
          data: {
            name: ct.name,
            slug: ct.slug,
            description: ct.description,
            tenantId: null,
            isPublished: true,
            fields: {
              create: ct.fields.map((f) => ({
                name: f.name,
                slug: f.slug,
                type: f.type,
                required: f.required,
                order: f.order,
              })),
            },
          },
        })
        console.log(`  🆕 SingleType "${ct.slug}" dibuat.`)
      } else {
        console.log(`  ✓  SingleType "${ct.slug}" sudah ada.`)
      }
    } else {
      // ── Collection Type ──
      let contentType = await prisma.contentType.findFirst({
        where: { slug: ct.slug, tenantId: null },
      })

      if (!contentType) {
        contentType = await prisma.contentType.create({
          data: {
            name: ct.name,
            slug: ct.slug,
            description: ct.description,
            tenantId: null,
            isPublished: true,
            fields: {
              create: ct.fields.map((f) => ({
                name: f.name,
                slug: f.slug,
                type: f.type,
                required: f.required,
                order: f.order,
              })),
            },
          },
        })
        console.log(`  🆕 ContentType "${ct.slug}" dibuat.`)
      } else {
        console.log(`  ✓  ContentType "${ct.slug}" sudah ada.`)
      }
    }
  }

  // ─── STEP 2: Seed all data ───
  console.log("\n📝 STEP 2: Mengisi data konten landing page...\n")

  for (const ct of CONTENT_TYPES) {
    const seedData = SEED_DATA[ct.slug]
    if (!seedData) {
      console.log(`  ⏭️  ${ct.slug}: tidak ada seed data, skip.`)
      continue
    }

    if (ct.isSingleType) {
      // ── Seed Single Type ──
      const st = await prisma.singleType.findFirst({
        where: { slug: ct.slug, tenantId: null },
      })
      if (!st) continue

      await prisma.tenantSingleTypeAssignment.deleteMany({
        where: { singleTypeId: st.id, tenantId: null },
      })

      await prisma.tenantSingleTypeAssignment.create({
        data: {
          tenantId: null,
          singleTypeId: st.id,
          data: seedData as any,
          publishedAt: new Date(),
        },
      })
      console.log(`  ✅ ${ct.slug}: single type data di-seed.`)

    } else {
      // ── Seed Collection ──
      const contentType = await prisma.contentType.findFirst({
        where: { slug: ct.slug, tenantId: null },
      })
      if (!contentType) continue

      const entries = Array.isArray(seedData) ? seedData : [seedData]

      // Hapus data lama
      await prisma.contentEntry.deleteMany({
        where: { contentTypeId: contentType.id, tenantId: null },
      })

      // Buat data baru
      for (const entry of entries) {
        await prisma.contentEntry.create({
          data: {
            contentTypeId: contentType.id,
            tenantId: null,
            status: "PUBLISHED",
            publishedAt: new Date(),
            data: entry,
          },
        })
      }
      console.log(`  ✅ ${ct.slug}: ${entries.length} entries di-seed.`)
    }
  }

  console.log("\n══════════════════════════════════════════════════")
  console.log("✨ Selesai! Semua data landing page sudah di-seed.")
  console.log("   Buka website untuk melihat hasilnya.")
  console.log("   Setelah ini bisa diubah langsung dari CMS dashboard.")
  console.log("══════════════════════════════════════════════════\n")
}

main()
  .catch((e) => {
    console.error("❌ Error:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
