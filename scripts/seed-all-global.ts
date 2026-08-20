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
      { name: "Avatar URL", slug: "avatar", type: "text", order: 3 },
      { name: "Social Links", slug: "social", type: "json", order: 4 },
    ]
  },
  {
    name: "Testimonial Item",
    slug: "sacms-component-testimonial",
    fields: [
      { name: "Name", slug: "name", type: "text", order: 0 },
      { name: "Role", slug: "role", type: "text", order: 1 },
      { name: "Content", slug: "content", type: "textarea", order: 2 },
      { name: "Avatar URL", slug: "avatar", type: "text", order: 3 },
      { name: "Rating", slug: "rating", type: "integer", order: 4 },
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
      { name: "Content", slug: "content", type: "textarea", order: 1 },
      { name: "Image URL", slug: "image", type: "text", order: 2 },
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

const COLLECTION_TYPES = [
  {
    name: "SaCMS Account Plans",
    slug: "sacms-account-pricing",
    description: "Account tiers that govern workspace limits",
    fields: [
      { slug: "name",        name: "Plan Name",     type: "text",    required: true,  order: 0 },
      { slug: "plan_slug",   name: "Plan Slug",     type: "text",    required: true,  order: 1 },
      { slug: "price",       name: "Price",         type: "number",  required: true,  order: 2 },
      { slug: "yearly_price",name: "Yearly Price",  type: "number",  required: false, order: 3 },
      { slug: "period",      name: "Period",        type: "text",    required: false, order: 4 },
      { slug: "max_workspaces", name: "Max Workspaces", type: "number", required: true, order: 5 },
      { slug: "description", name: "Description",   type: "text",    required: false, order: 6 },
      { slug: "features",    name: "Features",      type: "json",    required: false, order: 7 },
      { slug: "is_popular",  name: "Is Popular",    type: "boolean", required: false, order: 8 },
      { slug: "cta_text",    name: "CTA Text",      type: "text",    required: false, order: 9 },
      { slug: "cta_href",    name: "CTA URL",       type: "text",    required: false, order: 10 },
    ],
  },
  {
    name: "SaCMS Workspace Plans",
    slug: "sacms-workspace-pricing",
    description: "Pricing tiers for individual workspaces",
    fields: [
      { slug: "name",        name: "Plan Name",     type: "text",    required: true,  order: 0 },
      { slug: "plan_slug",   name: "Plan Slug",     type: "text",    required: true,  order: 1 },
      { slug: "price",       name: "Price",         type: "number",  required: true,  order: 2 },
      { slug: "yearly_price",name: "Yearly Price",  type: "number",  required: false, order: 3 },
      { slug: "period",      name: "Period",        type: "text",    required: false, order: 4 },
      { slug: "max_content_types",  name: "Max Content Types",  type: "number", required: true, order: 5 },
      { slug: "max_content_entries",name: "Max Content Entries",type: "number", required: true, order: 6 },
      { slug: "max_team_members",   name: "Max Team Members",   type: "number", required: true, order: 7 },
      { slug: "max_storage",        name: "Max Storage (MB)",   type: "number", required: true, order: 8 },
      { slug: "max_locales",        name: "Max Locales",        type: "number", required: true, order: 9 },
      { slug: "max_api_calls",      name: "Max API Calls/mo",   type: "number", required: true, order: 10 },
      { slug: "description", name: "Description",   type: "text",    required: false, order: 11 },
      { slug: "features",    name: "Features",      type: "json",    required: false, order: 12 },
    ],
  },
  {
    name: "SaCMS AI Credit Packs",
    slug: "sacms-ai-pricing",
    description: "Credit packs for AI Frontend and Schema generation",
    fields: [
      { slug: "name",        name: "Pack Name",    type: "text",    required: true,  order: 0 },
      { slug: "pack_slug",   name: "Pack Slug",    type: "text",    required: true,  order: 1 },
      { slug: "credits",     name: "Credits",      type: "number",  required: true,  order: 2 },
      { slug: "price_usd",   name: "Price (USD)",  type: "number",  required: true,  order: 3 },
      { slug: "price",       name: "Price (IDR)",  type: "number",  required: true,  order: 4 },
      { slug: "badge",       name: "Badge",        type: "text",    required: false, order: 5 },
      { slug: "description", name: "Description",  type: "text",    required: false, order: 6 },
      { slug: "features",    name: "Features",     type: "json",    required: false, order: 7 },
    ],
  },
  {
    name: "SaCMS Addons",
    slug: "sacms-addons",
    description: "Layanan tambahan opsional",
    fields: [
      { slug: "icon",        name: "Icon",        type: "text",   required: false, order: 0 },
      { slug: "name",        name: "Name",        type: "text",   required: true,  order: 1 },
      { slug: "addon_slug",  name: "Addon Slug",  type: "text",   required: true,  order: 2 },
      { slug: "description", name: "Description", type: "text",   required: false, order: 3 },
      { slug: "price",       name: "Price",       type: "number", required: false, order: 4 },
      { slug: "price_label", name: "Price Label", type: "text",   required: false, order: 5 },
      { slug: "unit",        name: "Unit",        type: "text",   required: false, order: 6 },
      { slug: "feature_key", name: "Feature Key", type: "text",   required: false, order: 7 },
    ],
  },
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
    hero_badge: "🚀 SaaS Headless Engine Generasi Baru",
    hero_title: "Hentikan Kerumitan Mengelola Puluhan CMS Terpisah.",
    hero_subtitle: "SaCMS adalah Headless CMS Multi-Tenant sejati. Satu codebase untuk mengelola semua klien Anda dengan isolasi data absolut, integrasi billing Midtrans otomatis, dan API secepat kilat.",
    hero_cta_primary: "Coba Gratis Sekarang",
    hero_cta_secondary: "Lihat Dokumentasi",
    hero_image: "",
    
    features: [
      { title: "Multi-Tenant Native", description: "Satu aplikasi SaCMS mengelola ratusan workspace secara independen. Data klien A tidak akan pernah bocor ke klien B berkat Row-Level Security (RLS).", icon: "Users", is_main: true, tag: "Keamanan" },
      { title: "Sistem Billing Otomatis", description: "Integrasi Midtrans bawaan. SaCMS otomatis mengunci akses workspace jika klien belum membayar tagihan bulanan. Tidak perlu lagi menagih manual.", icon: "CreditCard", is_main: true, tag: "Pendapatan" },
      { title: "Rate-Limiting Cerdas", description: "Didukung Upstash Redis di Edge. Mencegah klien tertentu memonopoli resource API yang bisa memperlambat klien lainnya.", icon: "Activity", is_main: false, tag: "Performa" },
      { title: "Webhooks Terdistribusi", description: "Bangun frontend dengan Next.js, Nuxt, atau Astro? Trigger webhook secara asinkron (via QStash) setiap ada perubahan data tanpa membebani server.", icon: "Webhook", is_main: false, tag: "Integrasi" },
      { title: "Role-Based Access Control", description: "Beri akses terbatas ke penulis, editor, atau admin klien. Anda sebagai Super Admin memiliki kendali penuh atas semua workspace.", icon: "ShieldCheck", is_main: true, tag: "Keamanan" },
      { title: "Penyimpanan Media S3-Compatible", description: "Terintegrasi langsung dengan Cloudflare R2 untuk penyimpanan gambar super murah dengan egress fee $0 dan performa CDN global.", icon: "Image", is_main: false, tag: "Media" },
      { title: "Generasi Konten Berbasis AI", description: "Tidak punya ide menulis? Integrasi OpenAI/Gemini bawaan membantu klien Anda menulis artikel SEO-friendly dalam hitungan detik.", icon: "Sparkles", is_main: false, tag: "Produktivitas" },
      { title: "GraphQL & REST API", description: "Skema GraphQL yang dibangun secara dinamis sesuai struktur konten yang Anda buat, lengkap dengan operator filter tingkat lanjut bergaya Strapi.", icon: "Database", is_main: true, tag: "Developer" },
    ],

    workflows: [
      { step: "1", title: "Buat Workspace Baru", description: "Buka dashboard Super Admin dan klik 'Buat Workspace'. Tentukan batas tipe konten, batas API, dan harga berlangganan bulanan.", icon: "PlusCircle" },
      { step: "2", title: "Rancang Struktur Data", description: "Gunakan Content-Type Builder visual untuk membuat relasi tabel, tipe data (text, rich text, media), dan single-types.", icon: "Table" },
      { step: "3", title: "Hubungkan Frontend", description: "Ambil API Key dari workspace, lalu gunakan di aplikasi Next.js, React Native, atau platform lainnya.", icon: "Link" },
      { step: "4", title: "Terima Pembayaran", description: "Klien login, melihat limit yang hampir habis, dan melakukan upgrade plan secara mandiri via Midtrans.", icon: "Banknote" },
    ],

    faqs: [
      { question: "Apakah SaCMS Open Source?", answer: "Saat ini SaCMS adalah produk komersial dengan lisensi sumber tertutup (closed-source) khusus untuk B2B dan Enterprise. Namun, kami menyediakan dokumentasi API terbuka." },
      { question: "Bisakah saya menggunakannya untuk toko online?", answer: "Tentu. SaCMS sangat fleksibel. Anda bisa membuat skema 'Produk', 'Pesanan', dan 'Kategori' dengan relasi dinamis." },
      { question: "Bagaimana jika saya ingin custom domain?", answer: "SaCMS mendukung multi-domain routing. Anda bisa mengarahkan domain klien (misal: admin.klien.com) langsung ke workspace mereka." },
      { question: "Apakah ada batasan jumlah workspace?", answer: "Tergantung paket Account Plan yang Anda pilih. Di paket Enterprise, jumlah workspace tidak dibatasi (unlimited)." },
    ],

    owners: [
      { name: "John Doe", role: "CEO & Founder", bio: "Berpengalaman 10 tahun di industri SaaS dan Headless CMS.", avatar: "", social: { twitter: "https://twitter.com", linkedin: "https://linkedin.com" } }
    ],

    testimonials: [
      { name: "Budi Santoso", role: "CTO Tech Indo", content: "Sangat membantu kami menghemat biaya server dan manajemen klien.", avatar: "", rating: 5 },
      { name: "Siti Aminah", role: "Freelance Web Dev", content: "Dulu pusing menagih klien, sekarang otomatis diurus sistem billing SaCMS.", avatar: "", rating: 5 },
    ],

    sectors: [
      { icon: "Building", label: "Digital Agency", desc: "Kelola puluhan klien web" },
      { icon: "Code", label: "Solo Developer", desc: "Kurangi biaya server" },
      { icon: "ShoppingBag", label: "E-Commerce", desc: "Katalog headless" },
      { icon: "Briefcase", label: "SaaS Builders", desc: "Backend data terpusat" },
    ],

    local_pride: {
      badge: "Solusi B2B Terbaik",
      title: "Dibangun Untuk Menjawab Masalah Nyata Developer.",
      description: "Kami memahami betapa frustrasinya mengelola banyak instance CMS terpisah dan menagih klien. SaCMS hadir untuk merangkum semua infrastruktur tersebut menjadi satu panel kontrol elegan.",
    },

    cta_banner: {
      title: "Siap Berhenti Melakukan Self-Host CMS?",
      description: "Pindahkan proyek klien Anda ke SaCMS. Skalabilitas tanpa batas, tanpa pusing.",
      button_primary_text: "Coba Gratis Sekarang",
      button_secondary_text: "Baca Dokumentasi API",
    },

    about: {
      title: "Tentang SaCMS",
      content: "SaCMS dibangun dari frustrasi mengelola puluhan instance Strapi dan WordPress terpisah untuk setiap klien...",
      image: ""
    },

    whatsapp: {
      phone: "6281234567890",
      message: "Halo, saya tertarik dengan SaCMS. Bisa minta info lebih lanjut?",
      label: "Hubungi Kami",
      is_active: true
    },

    footer: {
      brand_name: "SaCMS",
      description: "The Ultimate Multi-Tenant Headless CMS for Modern Developers and Agencies.",
      copyright: "SaCMS. Hak cipta dilindungi.",
    }
  },

  // ───── ACCOUNT PRICING (Collection) ─────
  "sacms-account-pricing": [
    { 
      name: "Akun Gratis", plan_slug: "free", price: 0, price_usd: 0, yearly_price: 0, period: "selamanya", description: "Mulai tanpa biaya.", 
      max_workspaces: 1,
      features: ["1 Workspace", "Dukungan Komunitas"], is_popular: false, cta_text: "Mulai Gratis", cta_href: "/register" 
    },
    { 
      name: "Akun Pemula", plan_slug: "starter", price: 99000, yearly_price: 990000, period: "bulan", description: "Untuk pengembang mandiri dan UMKM.", 
      max_workspaces: 3,
      features: ["3 Workspace", "Dukungan Email"], is_popular: false, cta_text: "Pilih Starter", cta_href: "/register" 
    },
    { 
      name: "Akun Profesional", plan_slug: "pro", price: 299000, yearly_price: 2990000, period: "bulan", description: "Untuk tim bertumbuh dan produk digital.", 
      max_workspaces: 10,
      features: ["10 Workspace", "Dukungan Prioritas"], is_popular: true, cta_text: "Pilih Pro", cta_href: "/register" 
    },
    { 
      name: "Akun Pemerintah", plan_slug: "enterprise", price: 999000, yearly_price: 9990000, period: "bulan", description: "Untuk instansi dan kapasitas skala besar.", 
      max_workspaces: 20,
      features: ["20 Workspace", "Dukungan Dedikasi", "SLA Khusus"], is_popular: false, cta_text: "Hubungi Kami", cta_href: "/register" 
    },
  ],

  // ───── WORKSPACE PRICING (Collection) ─────
  "sacms-workspace-pricing": [
    { 
      name: "Workspace Gratis", plan_slug: "free", price: 0, yearly_price: 0, period: "selamanya", description: "Kapasitas dasar untuk memulai.", 
      max_content_types: 3, max_content_entries: 500, max_team_members: 1, max_storage: 100, max_locales: 1, max_api_calls: 1000,
      features: ["3 Tipe Konten", "1.000 Request API/bulan", "100MB Penyimpanan", "1 Anggota Tim"]
    },
    { 
      name: "Workspace Pemula", plan_slug: "starter", price: 99000, yearly_price: 990000, period: "bulan", description: "Kapasitas lebih untuk satu workspace.", 
      max_content_types: 5, max_content_entries: 5000, max_team_members: 3, max_storage: 1024, max_locales: 2, max_api_calls: 10000,
      features: ["5 Tipe Konten", "10.000 Request API/bulan", "1GB Penyimpanan", "3 Anggota Tim", "2 Bahasa"]
    },
    { 
      name: "Workspace Profesional", plan_slug: "pro", price: 299000, yearly_price: 2990000, period: "bulan", description: "Performa tinggi untuk instansi.", 
      max_content_types: 10, max_content_entries: 10000, max_team_members: 10, max_storage: 5120, max_locales: 5, max_api_calls: 100000,
      features: ["10 Tipe Konten", "100.000 Request API/bulan", "5GB Penyimpanan", "10 Anggota Tim", "5 Bahasa"]
    },
    { 
      name: "Workspace Pemerintah", plan_slug: "enterprise", price: 999000, yearly_price: 9990000, period: "bulan", description: "Workspace dedikasi untuk pemerintah.", 
      max_content_types: 20, max_content_entries: 20000, max_team_members: 20, max_storage: 10240, max_locales: 20, max_api_calls: 1000000,
      features: ["20 Tipe Konten", "1.000.000 Request API/bulan", "10GB Penyimpanan", "Tim Unlimited", "Bahasa Unlimited"]
    },
  ],

  // ───── AI PRICING (Collection) ─────
  "sacms-ai-pricing": [
    {
      name: "Starter Credits",
      pack_slug: "ai_pack_starter",
      credits: 300,
      price_usd: 9,
      price: 149000,
      badge: "",
      description: "Top-up 300 AI credits for Next.js frontend builds.",
      features: [
        "300 AI Credits",
        "Sekali Beli (Never Expire)",
        "Full Next.js Frontend Gen",
        "Digunakan di Semua Workspace"
      ]
    },
    {
      name: "Pro Credits",
      pack_slug: "ai_pack_pro",
      credits: 1500,
      price_usd: 29,
      price: 449000,
      badge: "Most Popular",
      description: "Top-up 1,500 AI credits dengan antrean prioritas.",
      features: [
        "1.500 AI Credits",
        "Sekali Beli (Never Expire)",
        "Iterasi Desain AI Cepat",
        "Deploy 1-Klik Vercel",
        "Digunakan di Semua Workspace"
      ]
    },
    {
      name: "Business Credits",
      pack_slug: "ai_pack_business",
      credits: 5000,
      price_usd: 79,
      price: 1199000,
      badge: "",
      description: "Top-up 5,000 AI credits untuk tim produksi.",
      features: [
        "5.000 AI Credits",
        "Sekali Beli (Never Expire)",
        "Kapasitas Bebas Hambatan",
        "Export Schema & Kode Lengkap",
        "Digunakan di Semua Workspace"
      ]
    },
    {
      name: "Agency Credits",
      pack_slug: "ai_pack_agency",
      credits: 15000,
      price_usd: 149,
      price: 2299000,
      badge: "Best Value",
      description: "Top-up 15,000 AI credits untuk agensi dengan volume tinggi.",
      features: [
        "15.000 AI Credits",
        "Sekali Beli (Never Expire)",
        "Kecepatan AI Maksimal",
        "Dukungan Model Lanjutan",
        "Digunakan di Semua Workspace"
      ]
    }
  ],

  // ───── ADDONS (Collection) ─────
  "sacms-addons": [
    { name: "AI Writer", addon_slug: "ai_writer", feature_key: "ai", price_label: "Included in Pro", description: "Generate content effortlessly.", icon: "Sparkles" },
    { name: "Advanced Audit", addon_slug: "adv_audit", feature_key: "audit", price_label: "Enterprise Only", description: "Keep track of every action.", icon: "ShieldCheck" }
  ],

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
