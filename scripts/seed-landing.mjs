// Seed script untuk landing page SACMS
// Jalankan: bun run scripts/seed-landing.mjs

import { PrismaClient } from "../prisma/generated-client/index.js";

const db = new PrismaClient();

const GLOBAL_TENANT_ID = null;

// Copy paste from seed route
const CONTENT_TYPES = [
  {
    slug: "sacms-hero",
    name: "SaCMS Hero Section",
    isSingleType: true,
    fields: [
      { slug: "headline", name: "Headline", type: "text", required: true, order: 0 },
      { slug: "subheadline", name: "Subheadline", type: "text", required: false, order: 1 },
      { slug: "cta_primary", name: "CTA Primary", type: "text", required: false, order: 2 },
      { slug: "cta_secondary", name: "CTA Secondary", type: "text", required: false, order: 3 },
      { slug: "badge_text", name: "Badge Text", type: "text", required: false, order: 4 },
      { slug: "image_url", name: "Image URL", type: "text", required: false, order: 5 },
    ],
  },
  {
    slug: "sacms-features",
    name: "SaCMS Features",
    isSingleType: false,
    fields: [
      { slug: "icon", name: "Icon", type: "text", required: false, order: 0 },
      { slug: "title", name: "Title", type: "text", required: true, order: 1 },
      { slug: "description", name: "Description", type: "text", required: false, order: 2 },
      { slug: "color", name: "Color", type: "text", required: false, order: 3 },
    ],
  },
  {
    slug: "sacms-workflow",
    name: "SaCMS Workflow Steps",
    isSingleType: false,
    fields: [
      { slug: "step", name: "Step Number", type: "number", required: true, order: 0 },
      { slug: "title", name: "Title", type: "text", required: true, order: 1 },
      { slug: "description", name: "Description", type: "text", required: false, order: 2 },
      { slug: "icon", name: "Icon", type: "text", required: false, order: 3 },
    ],
  },
  {
    slug: "sacms-faq",
    name: "SaCMS FAQ",
    isSingleType: false,
    fields: [
      { slug: "question", name: "Question", type: "text", required: true, order: 0 },
      { slug: "answer", name: "Answer", type: "text", required: true, order: 1 },
      { slug: "order", name: "Order", type: "number", required: false, order: 2 },
    ],
  },
  {
    slug: "sacms-testimonials",
    name: "SaCMS Testimonials",
    isSingleType: false,
    fields: [
      { slug: "name", name: "Name", type: "text", required: true, order: 0 },
      { slug: "role", name: "Role", type: "text", required: false, order: 1 },
      { slug: "company", name: "Company", type: "text", required: false, order: 2 },
      { slug: "content", name: "Content", type: "text", required: true, order: 3 },
      { slug: "avatar_url", name: "Avatar URL", type: "text", required: false, order: 4 },
      { slug: "rating", name: "Rating", type: "number", required: false, order: 5 },
    ],
  },
  {
    slug: "sacms-owners",
    name: "SaCMS Team/Owners",
    isSingleType: false,
    fields: [
      { slug: "name", name: "Name", type: "text", required: true, order: 0 },
      { slug: "role", name: "Role", type: "text", required: false, order: 1 },
      { slug: "bio", name: "Bio", type: "text", required: false, order: 2 },
      { slug: "avatar_url", name: "Avatar URL", type: "text", required: false, order: 3 },
      { slug: "linkedin", name: "LinkedIn", type: "text", required: false, order: 4 },
    ],
  },
  {
    slug: "sacms-about",
    name: "SaCMS About Section",
    isSingleType: true,
    fields: [
      { slug: "title", name: "Title", type: "text", required: true, order: 0 },
      { slug: "description", name: "Description", type: "text", required: false, order: 1 },
      { slug: "mission", name: "Mission", type: "text", required: false, order: 2 },
      { slug: "founded", name: "Founded", type: "text", required: false, order: 3 },
    ],
  },
  {
    slug: "sacms-whatsapp",
    name: "SaCMS WhatsApp Config",
    isSingleType: true,
    fields: [
      { slug: "phone", name: "Phone", type: "text", required: true, order: 0 },
      { slug: "message", name: "Message", type: "text", required: false, order: 1 },
      { slug: "label", name: "Label", type: "text", required: false, order: 2 },
      { slug: "is_active", name: "Is Active", type: "boolean", required: false, order: 3 },
    ],
  },
  {
    slug: "sacms-addons",
    name: "SaCMS Addons",
    isSingleType: false,
    fields: [
      { slug: "icon", name: "Icon", type: "text", required: false, order: 0 },
      { slug: "name", name: "Name", type: "text", required: true, order: 1 },
      { slug: "description", name: "Description", type: "text", required: false, order: 2 },
      { slug: "price", name: "Price", type: "number", required: false, order: 3 },
      { slug: "unit", name: "Unit", type: "text", required: false, order: 4 },
    ],
  },
  {
    slug: "sacms-sectors",
    name: "SaCMS Service Sectors",
    isSingleType: false,
    fields: [
      { slug: "icon", name: "Icon", type: "text", required: false, order: 0 },
      { slug: "label", name: "Label", type: "text", required: true, order: 1 },
      { slug: "desc", name: "Description", type: "text", required: false, order: 2 },
    ],
  },
  {
    slug: "sacms-local-pride",
    name: "SaCMS Local Pride Section",
    isSingleType: true,
    fields: [
      { slug: "badge", name: "Badge", type: "text", required: false, order: 0 },
      { slug: "title", name: "Title", type: "text", required: true, order: 1 },
      { slug: "description", name: "Description", type: "text", required: false, order: 2 },
    ],
  },
  {
    slug: "sacms-cta",
    name: "SaCMS CTA Section",
    isSingleType: true,
    fields: [
      { slug: "title", name: "Title", type: "text", required: true, order: 0 },
      { slug: "description", name: "Description", type: "text", required: false, order: 1 },
      { slug: "button_primary_text", name: "Button Primary Text", type: "text", required: false, order: 2 },
      { slug: "button_secondary_text", name: "Button Secondary Text", type: "text", required: false, order: 3 },
    ],
  },
  {
    slug: "sacms-footer",
    name: "SaCMS Footer Section",
    isSingleType: true,
    fields: [
      { slug: "brand_name", name: "Brand Name", type: "text", required: false, order: 0 },
      { slug: "description", name: "Description", type: "text", required: false, order: 1 },
      { slug: "copyright", name: "Copyright", type: "text", required: false, order: 2 },
    ],
  },
];

const SEED_ENTRIES = {
  "sacms-hero": [
    {
      headline: "Modernisasi Digital untuk Tanah Papua",
      subheadline: "Platform CMS modern untuk membangun website pemerintah, portal berita, katalog UMKM, dan pariwisata di Papua. Dibangun dengan teknologi enterprise-grade untuk mendukung percepatan transformasi digital di Tanah Papua.",
      cta_primary: "Mulai Sekarang",
      cta_secondary: "Pelajari Selengkapnya",
      badge_text: "🏛️ Platform Digital Papua — Khusus Website Pemerintah",
    },
  ],
  "sacms-features": [
    { icon: "Shield", title: "Website Pemerintah", description: "Template dan sistem siap pakai untuk instansi pemerintah daerah di Papua. Mendukung transparansi informasi publik, pengumuman resmi, dan layanan masyarakat secara digital.", color: "indigo" },
    { icon: "Zap", title: "Portal Berita & Blog", description: "Sistem publikasi berita dan blog profesional untuk media lokal Papua. Dilengkapi kategori, penulis, penjadwalan publikasi, dan SEO otomatis.", color: "blue" },
    { icon: "Layout", title: "Katalog UMKM & Produk", description: "Etalase digital untuk wirausaha dan UMKM Papua. Tampilkan produk lokal, harga, dan informasi usaha kepada pasar yang lebih luas.", color: "purple" },
    { icon: "Globe", title: "Pariwisata Papua", description: "Showcase destinasi wisata dan kekayaan budaya Papua — dari Raja Ampat hingga Lembah Baliem. Website wisata yang memukau untuk menarik wisatawan.", color: "teal" },
  ],
  "sacms-workflow": [
    { step: 1, title: "Pilih Template", description: "Pilih template sesuai kebutuhan — Website Pemerintah, Portal Berita, Katalog UMKM, atau Pariwisata. Siap pakai dalam hitungan menit.", icon: "PenLine" },
    { step: 2, title: "Sesuaikan Konten", description: "Isi data instansi, upload logo dan foto, atur tampilan website. Dashboard CMS yang mudah digunakan siapa saja.", icon: "FileEdit" },
    { step: 3, title: "Kelola & Kolaborasi", description: "Undang tim untuk mengelola konten bersama. Sistem approval, penjadwalan publikasi, dan audit log bawaan.", icon: "Code2" },
    { step: 4, title: "Publikasikan", description: "Website siap online dan bisa diakses masyarakat Papua dan dunia. Performa cepat, aman, dan andal.", icon: "Rocket" },
  ],
  "sacms-faq": [
    { question: "Apakah SaCMS cocok untuk website pemerintah daerah?", answer: "Sangat cocok! SaCMS dirancang khusus dengan fitur keamanan enterprise-grade, kontrol akses berbasis peran, dan audit log yang memenuhi standar website pemerintah Indonesia.", order: 1 },
    { question: "Apakah ada paket gratis untuk UMKM?", answer: "Ya! Paket Gratis tersedia selamanya tanpa biaya dan tanpa kartu kredit. UMKM di Papua bisa langsung memulai dan upgrade ketika bisnis berkembang.", order: 2 },
    { question: "Apakah mendukung bahasa daerah Papua?", answer: "Ya, SaCMS mendukung multi-bahasa penuh. Anda bisa menambahkan bahasa Indonesia, bahasa daerah Papua, dan bahasa lainnya untuk menjangkau semua kalangan masyarakat.", order: 3 },
    { question: "Metode pembayaran apa saja yang didukung?", answer: "Kami menggunakan Midtrans yang mendukung transfer bank, kartu kredit, GoPay, OVO, DANA, dan banyak metode pembayaran Indonesia lainnya.", order: 4 },
  ],
  "sacms-testimonials": [
    { name: "Yohanes Wenda", role: "Kepala Bidang TIK", company: "Dinas Kominfo Papua", content: "SaCMS membantu kami membangun portal informasi pemerintah yang modern dan mudah dikelola. Transparansi informasi publik jadi lebih baik.", rating: 5 },
    { name: "Maria Rumbekwan", role: "Pemilik UMKM", company: "Noken Papua Store", content: "Berkat SaCMS, produk kerajinan noken kami sekarang bisa dilihat dan dipesan dari seluruh Indonesia. Omzet naik 3x lipat!", rating: 5 },
    { name: "Daniel Fatem", role: "Pengelola Pariwisata", company: "Raja Ampat Tourism", content: "Website pariwisata kami tampil profesional dan memukau. Jumlah wisatawan yang menghubungi kami meningkat drastis sejak menggunakan SaCMS.", rating: 5 },
  ],
  "sacms-owners": [
    { name: "Zonggonau Cristoper", role: "Founder & Lead Architect", bio: "Seorang pengembang perangkat lunak yang berdedikasi untuk membangun ekosistem teknologi digital di Papua. Berpengalaman dalam merancang sistem skala besar yang efisien dan aman.", avatar_url: "https://api.dicebear.com/7.x/avataaars/svg?seed=Cristoper" },
    { name: "Januar Fonda", role: "Core Developer", bio: "Pengembang Fullstack yang fokus pada performa dan skalabilitas sistem. Berkomitmen untuk menghadirkan pengalaman pengguna terbaik melalui teknologi modern.", avatar_url: "https://api.dicebear.com/7.x/avataaars/svg?seed=Januar" },
  ],
  "sacms-about": [
    { title: "Tentang SaCMS", description: "SaCMS adalah platform CMS modern yang lahir dari visi untuk mempercepat transformasi digital di Tanah Papua. Kami membangun teknologi website yang mudah digunakan untuk instansi pemerintah, UMKM, media, dan sektor pariwisata di seluruh Papua.", mission: "Mewujudkan Papua Digital — membawa infrastruktur teknologi informasi kelas dunia untuk mendukung kemajuan pemerintahan, ekonomi, dan pariwisata di Tanah Papua.", founded: "2024" },
  ],
  "sacms-whatsapp": [
    { phone: "6281234567890", message: "Halo! Saya tertarik dengan SaCMS.", label: "Hubungi Kami", is_active: true },
  ],
  "sacms-addons": [
    { icon: "Bot", name: "Paket AI Konten", description: "10.000 kredit tambahan untuk pembuatan konten otomatis dengan AI per bulan.", price: 49000, unit: "bulan" },
    { icon: "Database", name: "Penyimpanan Ekstra", description: "50GB tambahan penyimpanan untuk media, dokumen, dan aset digital.", price: 29000, unit: "bulan" },
  ],
  "sacms-sectors": [
    { icon: "Building2", label: "Pemerintahan", desc: "Website resmi pemerintah daerah Papua" },
    { icon: "Newspaper", label: "Portal Berita", desc: "Media dan portal berita lokal" },
    { icon: "Store", label: "UMKM", desc: "Katalog produk UMKM Papua" },
    { icon: "TreePine", label: "Pariwisata", desc: "Destinasi wisata Papua" },
    { icon: "Coffee", label: "Bisnis & Cafe", desc: "Profil bisnis dan cafe" },
    { icon: "Heart", label: "Organisasi", desc: "LSM dan organisasi masyarakat" },
  ],
  "sacms-local-pride": [
    { badge: "🌿 Tanah Papua", title: "Dibangun untuk Papua, oleh Putra Papua", description: "SaCMS lahir dari semangat untuk membawa teknologi digital terbaik ke Tanah Papua. Kami memahami kebutuhan unik setiap sektor — dari pemerintahan, UMKM, hingga pariwisata — dan menghadirkan solusi yang tepat guna." },
  ],
  "sacms-cta": [
    { title: "Siap Memulai Digitalisasi?", description: "Bergabunglah dengan puluhan instansi dan UMKM di Papua yang sudah menggunakan SaCMS. Gratis untuk memulai.", button_primary_text: "Mulai Sekarang", button_secondary_text: "Hubungi Kami" },
  ],
  "sacms-footer": [
    { brand_name: "SaCMS", description: "Platform Headless CMS modern yang dirancang khusus untuk mempercepat transformasi digital di Papua dan Indonesia.", copyright: "2026 SaCMS. Hak cipta dilindungi." },
  ],
};

async function seed() {
  console.log("🌱 Seeding landing page content...\n");

  for (const ct of CONTENT_TYPES) {
    console.log(`  📦 ${ct.name} (${ct.slug})...`);

    if (ct.isSingleType) {
      // Upsert SingleType
      let singleType = await db.singleType.findFirst({
        where: { slug: ct.slug, tenantId: GLOBAL_TENANT_ID },
      });

      if (!singleType) {
        singleType = await db.singleType.create({
          data: {
            name: ct.name,
            slug: ct.slug,
            tenantId: GLOBAL_TENANT_ID,
            isPublished: true,
            schemaFields: { create: ct.fields.map((f) => ({ ...f, options: undefined })) },
          },
        });
        console.log(`    ✅ Single type created`);
      }

      const entryData = SEED_ENTRIES[ct.slug]?.[0];
      if (!entryData) continue;

      // Delete old assignment
      await db.tenantSingleTypeAssignment.deleteMany({
        where: { tenantId: GLOBAL_TENANT_ID, singleTypeId: singleType.id },
      });

      await db.tenantSingleTypeAssignment.create({
        data: {
          tenantId: GLOBAL_TENANT_ID,
          singleTypeId: singleType.id,
          data: entryData,
          publishedAt: new Date(),
        },
      });
      console.log(`    ✅ Seed data inserted`);
    } else {
      // Upsert ContentType
      let contentType = await db.contentType.findFirst({
        where: { slug: ct.slug, tenantId: GLOBAL_TENANT_ID },
      });

      if (!contentType) {
        contentType = await db.contentType.create({
          data: {
            name: ct.name,
            slug: ct.slug,
            tenantId: GLOBAL_TENANT_ID,
            isPublished: true,
            schemaFields: { create: ct.fields.map((f) => ({ ...f, options: undefined })) },
          },
        });
        console.log(`    ✅ Content type created`);
      }

      const entries = SEED_ENTRIES[ct.slug];
      if (!entries) continue;

      // Clear old entries
      await db.contentEntry.deleteMany({
        where: { tenantId: GLOBAL_TENANT_ID, contentTypeId: contentType.id },
      });

      let count = 0;
      for (const entryData of entries) {
        await db.contentEntry.create({
          data: {
            tenantId: GLOBAL_TENANT_ID,
            contentTypeId: contentType.id,
            status: "PUBLISHED",
            data: entryData,
            publishedAt: new Date(),
          },
        });
        count++;
      }
      console.log(`    ✅ ${count} entries seeded`);
    }
  }

  console.log("\n✅ Seed complete!");
  await db.$disconnect();
}

seed().catch((e) => {
  console.error("❌ Seed failed:", e);
  process.exit(1);
});
