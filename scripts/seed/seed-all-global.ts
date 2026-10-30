import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

// ──────────────────────────────────────────────────────────
// SCHEMAS DEFINITION
// ──────────────────────────────────────────────────────────

const COMPONENTS = [
  {
    name: "Feature Item",
    slug: "sacms-component-feature",
    fields: [
      { name: "Title", slug: "title", type: "text", order: 0 },
      { name: "Description", slug: "description", type: "textarea", order: 1 },
      { name: "Icon Name", slug: "icon", type: "text", order: 2 },
      { name: "Is Main Feature", slug: "is_main", type: "boolean", order: 3 },
      { name: "Tag", slug: "tag", type: "text", order: 4 },
    ]
  },
  {
    name: "Workflow Item",
    slug: "sacms-component-workflow",
    fields: [
      { name: "Step Number", slug: "step", type: "text", order: 0 },
      { name: "Title", slug: "title", type: "text", order: 1 },
      { name: "Description", slug: "description", type: "textarea", order: 2 },
      { name: "Icon Name", slug: "icon", type: "text", order: 3 },
    ]
  },
  {
    name: "FAQ Item",
    slug: "sacms-component-faq",
    fields: [
      { name: "Question", slug: "question", type: "text", order: 0 },
      { name: "Answer", slug: "answer", type: "textarea", order: 1 },
    ]
  },
  {
    name: "Owner Profile",
    slug: "sacms-component-owner",
    fields: [
      { name: "Name", slug: "name", type: "text", order: 0 },
      { name: "Role", slug: "role", type: "text", order: 1 },
      { name: "Bio", slug: "bio", type: "textarea", order: 2 },
      { name: "Avatar URL", slug: "avatar_url", type: "text", order: 3 },
      { name: "LinkedIn URL", slug: "linkedin", type: "text", order: 4 },
    ]
  },
  {
    name: "Testimonial Item",
    slug: "sacms-component-testimonial",
    fields: [
      { name: "Name", slug: "name", type: "text", order: 0 },
      { name: "Role", slug: "role", type: "text", order: 1 },
      { name: "Company", slug: "company", type: "text", order: 2 },
      { name: "Content", slug: "content", type: "textarea", order: 3 },
      { name: "Avatar URL", slug: "avatar_url", type: "text", order: 4 },
      { name: "Rating", slug: "rating", type: "integer", order: 5 },
    ]
  },
  {
    name: "Sector Item",
    slug: "sacms-component-sector",
    fields: [
      { name: "Icon", slug: "icon", type: "text", order: 0 },
      { name: "Label", slug: "label", type: "text", order: 1 },
      { name: "Description", slug: "desc", type: "text", order: 2 },
    ]
  },
  {
    name: "Local Pride Section",
    slug: "sacms-component-local-pride",
    fields: [
      { name: "Badge Text", slug: "badge", type: "text", order: 0 },
      { name: "Title", slug: "title", type: "text", order: 1 },
      { name: "Description", slug: "description", type: "textarea", order: 2 },
    ]
  },
  {
    name: "CTA Banner",
    slug: "sacms-component-cta",
    fields: [
      { name: "Title", slug: "title", type: "text", order: 0 },
      { name: "Description", slug: "description", type: "text", order: 1 },
      { name: "Primary Button Text", slug: "button_primary_text", type: "text", order: 2 },
      { name: "Secondary Button Text", slug: "button_secondary_text", type: "text", order: 3 },
    ]
  },
  {
    name: "Footer Config",
    slug: "sacms-component-footer",
    fields: [
      { name: "Brand Name", slug: "brand_name", type: "text", order: 0 },
      { name: "Description", slug: "description", type: "text", order: 1 },
      { name: "Copyright Text", slug: "copyright", type: "text", order: 2 },
    ]
  },
  {
    name: "About Us Config",
    slug: "sacms-component-about",
    fields: [
      { name: "Title", slug: "title", type: "text", order: 0 },
      { name: "Description", slug: "description", type: "textarea", order: 1 },
      { name: "Mission", slug: "mission", type: "textarea", order: 2 },
      { name: "Founded Year", slug: "founded", type: "text", order: 3 },
      { name: "Image URL", slug: "image", type: "text", order: 4 },
    ]
  },
  {
    name: "WhatsApp Config",
    slug: "sacms-component-whatsapp",
    fields: [
      { name: "Phone Number", slug: "phone", type: "text", order: 0, required: true },
      { name: "Initial Message", slug: "message", type: "textarea", order: 1 },
      { name: "Button Label", slug: "label", type: "text", order: 2 },
      { name: "Is Active", slug: "is_active", type: "boolean", order: 3 },
    ]
  }
]

const SINGLE_TYPES = [
  {
    name: "Landing Page",
    slug: "sacms-landing-page",
    description: "Halaman Utama SaCMS",
    fields: [
      { name: "Hero Badge", slug: "hero_badge", type: "text", order: 0 },
      { name: "Hero Title", slug: "hero_title", type: "text", order: 1 },
      { name: "Hero Subtitle", slug: "hero_subtitle", type: "textarea", order: 2 },
      { name: "Hero Primary CTA", slug: "hero_cta_primary", type: "text", order: 3 },
      { name: "Hero Secondary CTA", slug: "hero_cta_secondary", type: "text", order: 4 },
      { name: "Hero Image URL", slug: "hero_image", type: "text", order: 5 },
      
      { name: "Features", slug: "features", type: "component", order: 6, options: { repeatable: true, componentSlug: "sacms-component-feature" } },
      { name: "Workflows", slug: "workflows", type: "component", order: 7, options: { repeatable: true, componentSlug: "sacms-component-workflow" } },
      { name: "FAQs", slug: "faqs", type: "component", order: 8, options: { repeatable: true, componentSlug: "sacms-component-faq" } },
      { name: "Owners", slug: "owners", type: "component", order: 9, options: { repeatable: true, componentSlug: "sacms-component-owner" } },
      { name: "Testimonials", slug: "testimonials", type: "component", order: 10, options: { repeatable: true, componentSlug: "sacms-component-testimonial" } },
      { name: "Sectors", slug: "sectors", type: "component", order: 11, options: { repeatable: true, componentSlug: "sacms-component-sector" } },
      
      { name: "Local Pride", slug: "local_pride", type: "component", order: 12, options: { repeatable: false, componentSlug: "sacms-component-local-pride" } },
      { name: "CTA Banner", slug: "cta_banner", type: "component", order: 13, options: { repeatable: false, componentSlug: "sacms-component-cta" } },
      { name: "About Us", slug: "about", type: "component", order: 14, options: { repeatable: false, componentSlug: "sacms-component-about" } },
      { name: "WhatsApp Config", slug: "whatsapp", type: "component", order: 15, options: { repeatable: false, componentSlug: "sacms-component-whatsapp" } },
      { name: "Footer", slug: "footer", type: "component", order: 16, options: { repeatable: false, componentSlug: "sacms-component-footer" } }
    ]
  }
]

// Account/workspace/AI-credit/addon pricing used to be seeded here as plain
// CMS Content Entries (sacms-account-pricing, sacms-workspace-pricing,
// sacms-ai-pricing, sacms-addons). That data now lives in its own dedicated
// tables (WorkspacePlan/AccountPlan/AiCreditPack/Addon), managed from
// /admin/pricing — every real reader (checkout, dashboards) already reads
// from there, not from these CMS entries. Deliberately not seeded here
// anymore so clicking "Setup Global Tenant" can't re-create a second,
// conflicting source of pricing truth.
const COLLECTION_TYPES = [
  {
    name: "Posts",
    slug: "posts",
    description: "Blog posts and articles",
    fields: [
      { name: "Title", slug: "title", type: "text", order: 0, required: true },
      { name: "Slug", slug: "slug", type: "text", order: 1, required: true },
      { name: "Content", slug: "content", type: "richText", order: 2 },
      { name: "Category", slug: "category", type: "select", order: 3, options: { choices: ["Berita", "Artikel", "Pengumuman"] } },
      { name: "Cover Image", slug: "cover_image", type: "media", order: 4 },
    ]
  }
]

// ──────────────────────────────────────────────────────────
// SEED DATA
// ──────────────────────────────────────────────────────────

const SEED_DATA: Record<string, any> = {
  // ───── LANDING PAGE (Single Type with Components) ─────
  "sacms-landing-page": {
    hero_badge: "",
    hero_title: "Build smarter. Manage easier. Scale faster.",
    hero_subtitle: "SaCMS (Smart Content Management System) adalah platform Headless CMS multi-tenant modern dengan database terisolasi per workspace, integrasi AI Assistant dari IDE, custom domain untuk brand Anda sendiri, GraphQL API yang fleksibel, dan billing otomatis.",
    hero_cta_primary: "Coba Gratis Sekarang",
    hero_cta_secondary: "Dokumentasi API",
    hero_image: "",
    
    features: [
      { title: "Hybrid Multi-Tenancy & Dedicated Appliance", description: "Mulai dari shared multi-tenant hemat biaya hingga Dedicated Database & Storage Appliance terisolasi penuh untuk privasi data absolut.", icon: "Layers", is_main: true, tag: "Infrastruktur" },
      { title: "Deploy Frontend 1-Command via MCP", description: "Kembangkan frontend Next.js/React di AI IDE favorit Anda (Antigravity, VS Code, Cursor), lalu deploy ke SaCMS Cloud Hosting langsung dari editor lewat tool MCP deploy_to_sacms.", icon: "Rocket", is_main: true, tag: "AI Powered" },
      { title: "Dynamic GraphQL, REST API & MCP", description: "Skema otomatis sesuai data model Anda, query filter canggih yang familiar bagi developer, dan integrasi AI IDE via Model Context Protocol (MCP).", icon: "Database", is_main: true, tag: "Developer" },
      { title: "SaCMS Custom DNS & Registrar", description: "Manajemen domain instan dengan verifikasi otomatis A-Record Apex, CNAME Subdomain, dan pencarian domain terintegrasi.", icon: "Globe", is_main: false, tag: "Networking" },
      { title: "Sistem Billing Otomatis Midtrans", description: "Tagihan otomatis berbasis workspace dan akun (QRIS, VA, Kartu Kredit) dengan proteksi akses dan top-up kuota terintegrasi.", icon: "CreditCard", is_main: true, tag: "Fintech" },
      { title: "Enterprise RBAC & 7-Stage Workflow", description: "Kontrol hak akses tim bertingkat dan alur publikasi konten terstruktur (Draft -> In Review -> Scheduled -> Published) lengkap dengan audit log.", icon: "ShieldCheck", is_main: true, tag: "Keamanan" },
      { title: "Rate-Limiting Cerdas & Edge Cache", description: "Didukung sistem caching edge performa tinggi — mencegah klien tertentu memonopoli resource API yang bisa memperlambat klien lainnya.", icon: "Activity", is_main: false, tag: "Performa" },
      { title: "Penyimpanan Media Tanpa Batas", description: "Object storage performa tinggi untuk aset media Anda, dengan biaya egress $0 dan CDN global.", icon: "HardDrive", is_main: false, tag: "Media" },
    ],

    workflows: [
      { step: "1", title: "Rancang Skema Data Visual", description: "Gunakan Visual Builder untuk membuat Content Types, Single Types, dan relasi data dengan drag-and-drop.", icon: "Table" },
      { step: "2", title: "Generasi & Kelola Konten", description: "Tulis konten bersama tim dengan role RBAC atau generate artikel instan via AI Assistant.", icon: "Sparkles" },
      { step: "3", title: "Konsumsi API & Deploy Frontend", description: "Ambil API Key dari workspace untuk Next.js, Mobile App, atau kembangkan frontend-nya di IDE lalu deploy lewat tool MCP deploy_to_sacms.", icon: "Link" },
      { step: "4", title: "Automasi Domain & Billing", description: "Sambungkan custom domain klien dengan auto-DNS, dan biarkan billing Midtrans menagih secara otomatis.", icon: "Banknote" },
    ],

    faqs: [
      { question: "Apa perbedaan Shared Database vs Dedicated Appliance?", answer: "Shared Database cocok untuk proyek standar dan UMKM yang mengutamakan efisiensi biaya. Dedicated Appliance mem-provisioning database dan storage terisolasi penuh untuk privasi data 100% dan kebutuhan enterprise/pemerintah." },
      { question: "Bagaimana cara membangun frontend dengan IDE menggunakan SaCMS?", answer: "Hubungkan AI IDE (Antigravity, VS Code, Cursor, dll) ke SaCMS lewat Model Context Protocol (MCP) menggunakan API Key workspace Anda. AI agent di IDE bisa langsung membaca skema, query/tulis konten, dan deploy frontend ke SaCMS Cloud Hosting lewat tool deploy_to_sacms — semua tanpa keluar dari editor." },
      { question: "Bagaimana alur integrasi Custom Domain SaCMS?", answer: "Cukup masukkan nama domain Anda (misal: website.com atau subdomain.klien.com). SaCMS menyediakan instruksi DNS A-Record dan CNAME otomatis lengkap dengan verifikasi DNS dan challenge token." },
      { question: "Metode pembayaran apa saja yang didukung?", answer: "Seluruh pembayaran lokal via Midtrans: QRIS, GoPay, OVO, ShopeePay, Transfer Virtual Account bank terkemuka, dan Kartu Kredit Visa/Mastercard." },
    ],

    owners: [
      { 
        name: "Cristoper Zonggonau", 
        role: "Platform Architect & Founder", 
        bio: "Spesialis arsitektur sistem multi-tenant, cloud edge computing, dan pengembang inti platform SaCMS.", 
        avatar_url: "https://api.dicebear.com/7.x/avataaars/svg?seed=Cristoper", 
        linkedin: "https://linkedin.com" 
      },
      { 
        name: "Januar Fonda", 
        role: "Head of Engineering", 
        bio: "Fokus pada integrasi GraphQL performa tinggi, arsitektur web modern, dan sistem automasi AI coding.",
        avatar_url: "https://api.dicebear.com/7.x/avataaars/svg?seed=Januar", 
        linkedin: "https://linkedin.com" 
      },
      { 
        name: "Tim SaCMS", 
        role: "Product & Infrastructure", 
        bio: "Membangun dedicated database appliance dan sistem billing otomatis untuk pasar enterprise.",
        avatar_url: "https://api.dicebear.com/7.x/avataaars/svg?seed=Team", 
        linkedin: "https://linkedin.com" 
      }
    ],

    testimonials: [
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
      { 
        name: "Budi Santoso", 
        role: "CTO", 
        company: "Tech Media Group", 
        content: "Arsitektur multi-tenant dengan isolasi data tingkat enterprise memberi rasa aman bagi klien enterprise kami.",
        avatar_url: "https://api.dicebear.com/7.x/avataaars/svg?seed=Budi", 
        rating: 5 
      }
    ],

    sectors: [
      { icon: "Building2", label: "Digital Agency & Software House", desc: "Kelola puluhan website klien dari satu dasbor white-label tanpa pusing biaya server terpisah." },
      { icon: "Landmark", label: "Pemerintah & BUMN", desc: "Keamanan database terisolasi, kedaulatan data lokal, dan kepatuhan audit sistem." },
      { icon: "ShoppingBag", label: "E-Commerce & Startup", desc: "Manajemen inventaris dinamis, API transaksi kilat, dan integrasi headless storefront modern." },
      { icon: "Code2", label: "Solo Builders & Developers", desc: "Luncurkan MVP dalam hitungan jam dengan paket ekonomis, visual schema builder, dan AI website assistant." },
    ],

    local_pride: {
      badge: "Dibangun di Nabire, Papua Tengah",
      title: "Lahir di Papua. Dibangun untuk Bersaing Secara Global.",
      description: "SaCMS dirancang dan dikembangkan oleh talenta digital asli Papua di Nabire, Papua Tengah — bukti bahwa produk teknologi kelas dunia tidak harus lahir di Jakarta. Kami percaya UMKM, pemerintah daerah, kreator, dan startup di Papua berhak memakai infrastruktur digital yang sama cepat dan sekuat yang dipakai startup di kota besar, tanpa harus meninggalkan tanah sendiri.",
    },

    cta_banner: {
      title: "Build smarter. Manage easier. Scale faster.",
      description: "Mulai gunakan SaCMS (Smart Content Management System) hari ini. Nikmati arsitektur multi-tenant murni, performa secepat kilat, dan tagihan otomatis.",
      button_primary_text: "Coba Gratis Sekarang",
      button_secondary_text: "Baca Dokumentasi API",
    },

    about: {
      title: "Tentang SaCMS — Smart Content Management System",
      description: "<p>SaCMS (Smart Content Management System) lahir dengan moto <strong>'Build smarter. Manage easier. Scale faster.'</strong> — mendemokratisasi teknologi Headless CMS dan Dedicated Appliance kelas enterprise untuk seluruh developer, software house, dan instansi.</p><p class=\"mt-3\">Dengan arsitektur Hybrid Multi-Tenancy dan Dedicated Database Appliance, SaCMS memberikan performa maksimal, privasi data absolut, dan integrasi modern tanpa kompromi.</p>",
      mission: "Membantu para developer dan bisnis membangun produk digital lebih cerdas (Build smarter), mengelola konten lebih mudah (Manage easier), dan menskalakan infrastruktur lebih cepat (Scale faster).",
      founded: "2026",
      image: ""
    },

    whatsapp: {
      phone: "6282199220551",
      message: "Halo! Saya tertarik dengan integrasi SaCMS untuk proyek web saya.",
      label: "Hubungi Kami",
      is_active: true
    },

    footer: {
      brand_name: "SaCMS",
      description: "SaCMS — Smart Content Management System. Build smarter. Manage easier. Scale faster. Platform SaaS Headless CMS terdepan untuk transformasi digital.",
      copyright: "SaCMS. Hak cipta dilindungi.",
    }
  },

  // ───── POSTS (Collection) ─────
  "posts": [
    { title: "Selamat Datang di SaCMS", slug: "selamat-datang", content: "<p>Ini adalah post pertama Anda.</p>", category: "Pengumuman", cover_image: "" },
    { title: "Cara Mengelola Konten", slug: "cara-mengelola", content: "<p>Gunakan menu sebelah kiri untuk mengelola konten.</p>", category: "Tutorial", cover_image: "" }
  ]
}

// ──────────────────────────────────────────────────────────
// SYNC HELPERS
// ──────────────────────────────────────────────────────────

const syncComponent = async (data: { name: string, slug: string, description?: string, fields: any[] }) => {
  let comp = await prisma.component.findFirst({
    where: { tenantId: null, slug: data.slug }
  })
  if (comp) {
    comp = await prisma.component.update({
      where: { id: comp.id },
      data: { name: data.name, description: data.description }
    })
  } else {
    comp = await prisma.component.create({
      data: {
        name: data.name,
        slug: data.slug,
        description: data.description,
        tenantId: null,
      }
    })
  }

  for (const field of data.fields) {
    await prisma.schemaField.upsert({
      where: { componentId_slug: { componentId: comp.id, slug: field.slug } },
      update: {
        name: field.name, type: field.type, order: field.order,
        required: field.required || false, options: field.options || null
      },
      create: {
        componentId: comp.id, name: field.name, slug: field.slug, type: field.type,
        order: field.order, required: field.required || false, options: field.options || null
      }
    })
  }
  return comp
}

const syncContentType = async (data: { name: string, slug: string, description?: string, fields: any[] }) => {
  let ct = await prisma.contentType.findFirst({
    where: { tenantId: null, slug: data.slug }
  })
  if (ct) {
    ct = await prisma.contentType.update({
      where: { id: ct.id },
      data: { name: data.name, description: data.description }
    })
  } else {
    ct = await prisma.contentType.create({
      data: {
        name: data.name,
        slug: data.slug,
        description: data.description,
        tenantId: null,
        isPublished: true,
      }
    })
  }
  for (const field of data.fields) {
    await prisma.schemaField.upsert({
      where: { contentTypeId_slug: { contentTypeId: ct.id, slug: field.slug } },
      update: {
        name: field.name, type: field.type, order: field.order,
        required: field.required || false, options: field.options || null
      },
      create: {
        contentTypeId: ct.id, name: field.name, slug: field.slug, type: field.type,
        order: field.order, required: field.required || false, options: field.options || null
      }
    })
  }
  return ct
}

const syncSingleType = async (data: { name: string, slug: string, description?: string, fields: any[] }) => {
  let st = await prisma.singleType.findFirst({
    where: { tenantId: null, slug: data.slug }
  })
  if (st) {
    st = await prisma.singleType.update({
      where: { id: st.id },
      data: { name: data.name, description: data.description }
    })
  } else {
    st = await prisma.singleType.create({
      data: {
        name: data.name,
        slug: data.slug,
        description: data.description,
        tenantId: null,
        isPublished: true,
      }
    })
  }
  for (const field of data.fields) {
    await prisma.schemaField.upsert({
      where: { singleTypeId_slug: { singleTypeId: st.id, slug: field.slug } },
      update: {
        name: field.name, type: field.type, order: field.order,
        required: field.required || false, options: field.options || null
      },
      create: {
        singleTypeId: st.id, name: field.name, slug: field.slug, type: field.type,
        order: field.order, required: field.required || false, options: field.options || null
      }
    })
  }
  return st
}

// ──────────────────────────────────────────────────────────
// MAIN FUNCTION
// ──────────────────────────────────────────────────────────
async function main() {
  console.log("══════════════════════════════════════════════════")
  console.log("🌱 SaCMS Global Seed — Papua Digital")
  console.log("══════════════════════════════════════════════════\n")

  // ─── STEP 0: Ensure Global Tenant exists ───
  let globalTenantId = "sacms-global";
  try {
    const setting = await prisma.setting.findUnique({ where: { key: "globalTenantId" } });
    if (setting && setting.value) {
      globalTenantId = setting.value;
    }
  } catch (err) {
    console.error("Error reading globalTenantId setting", err);
  }

  let globalTenant = await prisma.tenant.findUnique({ where: { id: globalTenantId } })
  if (!globalTenant) {
    globalTenant = await prisma.tenant.create({
      data: {
        id: globalTenantId,
        name: "SaCMS Global",
        slug: globalTenantId,
        plan: "ENTERPRISE",
        status: "active"
      }
    })
  }

  // ─── STEP 0.5: Hapus schema lama yang digantikan ───
  console.log("🧹 STEP 0.5: Menghapus schema lama yang digantikan (Pembersihan)...")
  
  // Dulu mereka adalah Collection/Single Types, sekarang jadi Component. Hapus yang lama.
  const oldSlugsToDelete = [
    "sacms-hero", "sacms-features", "sacms-workflow", "sacms-faq", 
    "sacms-testimonials", "sacms-owners", "sacms-sectors", "sacms-local-pride", 
    "sacms-cta", "sacms-footer", "sacms-about", "sacms-whatsapp", "templates"
  ]
  await prisma.contentType.deleteMany({ where: { slug: { in: oldSlugsToDelete } } })
  await prisma.singleType.deleteMany({ where: { slug: { in: oldSlugsToDelete } } })

  // ─── STEP 1: Sync Schemas (Components, Single Types, Collection Types) ───
  console.log("\n📐 STEP 1: Memastikan semua Schema tersedia...\n")

  for (const c of COMPONENTS) {
    await syncComponent(c)
    console.log(`  ✓ Component "${c.slug}" tersinkronisasi.`)
  }

  for (const st of SINGLE_TYPES) {
    await syncSingleType(st)
    console.log(`  ✓ SingleType "${st.slug}" tersinkronisasi.`)
  }

  for (const ct of COLLECTION_TYPES) {
    await syncContentType(ct)
    console.log(`  ✓ ContentType "${ct.slug}" tersinkronisasi.`)
  }

  // ─── STEP 2: Seed all data ───
  console.log("\n📝 STEP 2: Mengisi data konten...\n")

  // Seed Single Types Data
  for (const st of SINGLE_TYPES) {
    const seedData = SEED_DATA[st.slug]
    if (!seedData) continue

    const singleType = await prisma.singleType.findFirst({ where: { slug: st.slug, tenantId: null } })
    if (!singleType) continue

    await prisma.tenantSingleTypeAssignment.deleteMany({
      where: { singleTypeId: singleType.id, tenantId: globalTenant.id },
    })

    await prisma.tenantSingleTypeAssignment.create({
      data: {
        singleTypeId: singleType.id,
        tenantId: globalTenant.id,
        data: seedData as any,
        publishedAt: new Date(),
      },
    })
    console.log(`  ✅ Data SingleType ${st.slug} berhasil di-seed.`)
  }

  // Seed Collection Types Data
  for (const ct of COLLECTION_TYPES) {
    const seedData = SEED_DATA[ct.slug]
    if (!seedData) continue

    const contentType = await prisma.contentType.findFirst({ where: { slug: ct.slug, tenantId: null } })
    if (!contentType) continue

    const entries = Array.isArray(seedData) ? seedData : [seedData]

    await prisma.contentEntry.deleteMany({
      where: { contentTypeId: contentType.id, tenantId: globalTenant.id },
    })

    for (const entry of entries) {
      const created = await prisma.contentEntry.create({
        data: {
          contentTypeId: contentType.id,
          tenantId: globalTenant.id,
          locale: "en",
          status: "PUBLISHED",
          publishedAt: new Date(),
          data: entry,
        },
      })
      await prisma.contentEntry.update({
        where: { id: created.id },
        data: { documentId: created.id }
      })
    }
    console.log(`  ✅ Data ContentType ${ct.slug} berhasil di-seed (${entries.length} entries).`)
  }

  console.log("\n══════════════════════════════════════════════════")
  console.log("✨ Selesai! Semua data telah diperbarui ke struktur baru.")
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
