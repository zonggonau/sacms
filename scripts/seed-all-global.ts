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
// SEED DATA — Semua konten landing page
// ──────────────────────────────────────────────────────────
const SEED_DATA: Record<string, object | object[]> = {

  // ───── HERO (Single Type) ─────
  "sacms-hero": {
    headline: "Hentikan Kerumitan Mengelola Puluhan CMS Terpisah.",
    subheadline: "SaCMS adalah Headless CMS Multi-Tenant sejati. Satu codebase untuk mengelola semua klien Anda dengan isolasi data absolut, integrasi billing Midtrans otomatis, dan API secepat kilat.",
    cta_primary: "Coba Gratis Sekarang",
    cta_secondary: "Lihat Dokumentasi",
    badge_text: "🚀 SaaS Headless Engine Generasi Baru",
    image_url: ""
  },

  // ───── FEATURES (Collection) ─────
  "sacms-features": [
    { icon: "Shield",     title: "Isolasi Data Absolut",       description: "Arsitektur multi-tenant murni di level database. Tidak ada lagi risiko kebocoran data antar klien atau setup instance terpisah yang mahal.", color: "indigo" },
    { icon: "CreditCard", title: "Billing Midtrans Otomatis",  description: "Monetisasi layanan CMS Anda langsung ke klien. Integrasi Midtrans Snap API bawaan untuk tagihan berlangganan otomatis.", color: "blue" },
    { icon: "Zap",        title: "Edge-Optimized API",         description: "Waktu respons API Publik di bawah 200ms dengan caching Upstash Redis. Hilangkan masalah waterfall request di frontend.", color: "teal" },
    { icon: "Database",   title: "Schema Builder Dinamis",     description: "Buat struktur database kompleks (Collection & Single Types) tanpa coding, langsung dari antarmuka visual yang modern.", color: "slate" },
    { icon: "Cloud",      title: "Cloudflare R2 Media",        description: "Penyimpanan aset digital terdistribusi CDN tanpa membebani database utama. Dilengkapi auto-thumbnail generation.", color: "purple" },
    { icon: "Webhook",    title: "Sinkronisasi Webhook",       description: "Hubungkan CMS ke berbagai platform frontend Anda dengan Webhook asinkron dan sistem antrian gagal (Dead Letter Queue).", color: "pink" },
    { icon: "Users",      title: "Granular Role-Based Access", description: "Atur izin akses untuk klien (Owner, Admin, Editor) untuk membatasi fitur modifikasi skema atau penagihan sesuai kebutuhan.", color: "yellow" },
    { icon: "Search",     title: "Full-Text Search & Filter",  description: "REST API & GraphQL dilengkapi operator filter dinamis dan dukungan pencarian teks penuh (FTS) secara bawaan.", color: "orange" },
  ],

  // ───── WORKFLOW (Collection) ─────
  "sacms-workflow": [
    { step: 1, title: "Daftar Akun",      description: "Buat akun Anda secara gratis dan dapatkan akses penuh ke panel kontrol Super Admin SaCMS.", icon: "UserPlus" },
    { step: 2, title: "Buat Workspace",   description: "Tambahkan workspace baru untuk setiap proyek klien. Batasi akses dan pantau pemakaian API secara real-time.", icon: "Building" },
    { step: 3, title: "Rancang Skema",    description: "Buat Content Type dinamis dan undang klien Anda untuk mulai mengisi data via dashboard interaktif.", icon: "Database" },
    { step: 4, title: "Konsumsi API",     description: "Gunakan Bearer Token untuk mengambil data di aplikasi frontend Anda melalui REST atau GraphQL.", icon: "Code" },
  ],

  // ───── FAQ (Collection) ─────
  "sacms-faq": [
    { question: "Apa kelebihan SaCMS dibandingkan Strapi?", answer: "Strapi mengharuskan Anda melakukan self-host instance terpisah untuk setiap klien (tidak ada fitur multi-tenant asli). SaCMS adalah SaaS murni yang memungkinkan Anda mengelola ribuan klien dari satu codebase dan dashboard.", order: 1 },
    { question: "Apakah SaCMS mendukung pembayaran lokal?", answer: "Ya, SaCMS sudah terintegrasi secara mendalam dengan Midtrans untuk menangani tagihan berlangganan otomatis ke klien Anda melalui GoPay, Virtual Account, hingga Kartu Kredit.", order: 2 },
    { question: "Bagaimana cara kerja API-nya?", answer: "SaCMS menyediakan REST API dengan filter ala Strapi dan GraphQL API. Seluruh request dilindungi dengan API Token terenkripsi SHA-256 dan dilimitasi oleh Upstash Redis di level Edge.", order: 3 },
    { question: "Apakah data klien saya aman?", answer: "Sangat aman. SaCMS menerapkan isolasi data multi-tenant secara absolut di level Prisma ORM. Sebuah query tidak akan pernah bisa mengakses data dari Tenant ID yang berbeda.", order: 4 },
  ],

  // ───── ADDONS (Collection) ─────
  "sacms-addons": [
    { icon: "Database", name: "Penyimpanan Ekstra",   description: "50GB tambahan penyimpanan Cloudflare R2 untuk aset digital berat.", price: 29000, unit: "bulan" },
    { icon: "Zap",      name: "Boost API Request",    description: "Tambahan kuota 500.000 API request untuk traffic website tinggi.",  price: 39000, unit: "bulan" },
  ],

  // ───── TESTIMONIALS (Collection) ─────
  "sacms-testimonials": [
    {
      name: "Zonggonau Cristoper",
      role: "Solo Developer",
      company: "Indie Hacker",
      content: "Dulu saya harus setup droplet baru tiap kali ada klien web company profile. Sekarang semua masuk ke SaCMS, hemat biaya server 80%!",
      avatar_url: "https://api.dicebear.com/7.x/avataaars/svg?seed=Cristoper",
      rating: 5
    },
    {
      name: "Januar Fonda",
      role: "Tech Lead",
      company: "Digital Agency",
      content: "Fitur auto-billing via Midtrans sangat membantu kami menagih biaya langganan bulanan ke klien tanpa harus kirim invoice manual lagi.",
      avatar_url: "https://api.dicebear.com/7.x/avataaars/svg?seed=Januar",
      rating: 5
    },
  ],

  // ───── OWNERS / TIM (Collection) ─────
  "sacms-owners": [
    {
      name: "Tim SaCMS",
      role: "Platform Engineers",
      bio: "Dibangun oleh developer untuk developer, memecahkan masalah fragmentasi CMS.",
      avatar_url: "https://api.dicebear.com/7.x/avataaars/svg?seed=Team",
      linkedin: ""
    }
  ],

  // ───── ABOUT (Single Type) ─────
  "sacms-about": {
    title: "Tentang SaCMS",
    description: "Platform Headless CMS generasi baru yang menghilangkan kompleksitas pengelolaan infrastruktur untuk agensi dan freelance developer.",
    mission: "Mempercepat pengiriman proyek digital dengan infrastruktur CMS yang terpusat, aman, dan mudah dimonetisasi.",
    founded: "2026"
  },

  // ───── WHATSAPP CONFIG (Single Type) ─────
  "sacms-whatsapp": {
    phone: "6282199220551",
    message: "Halo! Saya ingin berdiskusi mengenai integrasi SaCMS untuk agensi saya.",
    label: "Hubungi Kami",
    is_active: true
  },

  // ───── SECTORS (Collection) ─────
  "sacms-sectors": [
    { icon: "Building", label: "Digital Agency", desc: "Kelola puluhan klien web" },
    { icon: "Code", label: "Solo Developer", desc: "Kurangi biaya server" },
    { icon: "ShoppingBag", label: "E-Commerce", desc: "Katalog headless" },
    { icon: "Briefcase", label: "SaaS Builders", desc: "Backend data terpusat" },
  ],

  // ───── LOCAL PRIDE (Single Type) ─────
  "sacms-local-pride": {
    badge: "Solusi B2B Terbaik",
    title: "Dibangun Untuk Menjawab Masalah Nyata Developer.",
    description: "Kami memahami betapa frustrasinya mengelola banyak instance CMS terpisah dan menagih klien. SaCMS hadir untuk merangkum semua infrastruktur tersebut menjadi satu panel kontrol elegan.",
  },

  // ───── CTA BANNER (Single Type) ─────
  "sacms-cta": {
    title: "Siap Berhenti Melakukan Self-Host CMS?",
    description: "Pindahkan proyek klien Anda ke SaCMS. Skalabilitas tanpa batas, tanpa pusing.",
    button_primary_text: "Coba Gratis Sekarang",
    button_secondary_text: "Baca Dokumentasi API",
  },

  // ───── FOOTER (Single Type) ─────
  "sacms-footer": {
    brand_name: "SaCMS",
    description: "The Ultimate Multi-Tenant Headless CMS for Modern Developers and Agencies.",
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
