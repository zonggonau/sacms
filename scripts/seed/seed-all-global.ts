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
      // Informational fair-use figure for shared-Vercel-hosting plans
      // (Cloud Ekonomis: free/pro/business) — NOT a literally metered byte
      // count (Vercel doesn't expose a stable per-project bandwidth API to
      // enforce against). It's the marketing-facing number tied to the
      // max_api_calls quota that IS actually enforced (see
      // checkApiCallQuota() in lib/plan-enforcement.ts) — every request a
      // tenant's deployed frontend makes to fetch content lands there.
      // Left 0/unset for a dedicated/BYODB tenant: its bandwidth is bounded
      // by its own appliance, not a shared Vercel account.
      { slug: "fair_use_bandwidth_gb", name: "Fair-Use Bandwidth (GB/bulan)", type: "number", required: false, order: 11 },
      { slug: "description", name: "Description",   type: "text",    required: false, order: 12 },
      { slug: "features",    name: "Features",      type: "json",    required: false, order: 13 },
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

  // ───── ACCOUNT PRICING (Collection) ─────
  "sacms-account-pricing": [
    { 
      name: "Akun Gratis", 
      plan_slug: "free", 
      price: 0, 
      price_usd: 0, 
      yearly_price: 0, 
      period: "selamanya", 
      description: "Mulai tanpa biaya untuk eksplorasi dan pengembangan sandbox.", 
      max_workspaces: 1,
      features: [
        "1 Workspace Mandiri",
        "Akses Penuh CMS Editor & API",
        "Dukungan Komunitas"
      ], 
      is_popular: false, 
      cta_text: "Mulai Gratis", 
      cta_href: "/register" 
    },
    { 
      name: "Akun Standar", 
      plan_slug: "starter", 
      price: 49000, 
      yearly_price: 390000, 
      period: "bulan", 
      description: "Sangat ekonomis untuk solo developer, freelance & UMKM.", 
      max_workspaces: 3,
      features: [
        "Hingga 3 Workspace Aktif",
        "Multi-Project Management UMKM",
        "Akses REST & GraphQL API",
        "Dukungan Email Prioritas"
      ], 
      is_popular: false, 
      cta_text: "Pilih Standar", 
      cta_href: "/register" 
    },
    { 
      name: "Akun Profesional", 
      plan_slug: "pro", 
      price: 129000, 
      yearly_price: 990000, 
      period: "bulan", 
      description: "Paling diminati untuk agensi digital, startup & tim produk.", 
      max_workspaces: 5,
      features: [
        "Hingga 5 Workspace Aktif",
        "Kolaborasi Multi-Tim & RBAC",
        "Custom Domain Routing",
        "Audit Log & Security Center",
        "Dukungan Prioritas 24/7"
      ], 
      is_popular: true, 
      cta_text: "Pilih Pro", 
      cta_href: "/register" 
    },
    { 
      name: "Akun Bisnis & Agensi", 
      plan_slug: "enterprise", 
      price: 299000, 
      yearly_price: 2490000, 
      period: "bulan", 
      description: "Kapasitas besar untuk software house & agensi berskala.", 
      max_workspaces: 10,
      features: [
        "Hingga 10 Workspace Aktif",
        "Multi-Tenant Enterprise Hub",
        "Dedicated White-Label Branding",
        "Custom Role & Fine-Grained Permissions",
        "Dedicated Account Manager & SLA 99.9%"
      ], 
      is_popular: false, 
      cta_text: "Pilih Bisnis", 
      cta_href: "/register" 
    },
  ],

  // ───── WORKSPACE PRICING (Collection) ─────
  "sacms-workspace-pricing": [
    // ─── 1. CLOUD EKONOMIS (SHARED SAAS — 50% MARGIN) ───
    { 
      name: "SaCMS Free Forever", 
      plan_slug: "free", 
      price: 0, 
      yearly_price: 0, 
      period: "selamanya", 
      description: "Kapasitas dasar gratis untuk belajar, eksplorasi, dan pengembangan sandbox.", 
      max_content_types: 999999, 
      max_content_entries: 500, 
      max_team_members: 1, 
      max_storage: 100, 
      max_locales: 1,
      max_api_calls: 1000,
      fair_use_bandwidth_gb: 2,
      features: [
        "Unlimited Content Schemas & Tipe Data",
        "500 Entri Konten Dinamis",
        "1 Anggota Tim",
        "100 MB Cloud Storage",
        "1.000 API Calls / bulan",
        "Fair-Use Bandwidth ~2 GB/bulan (Shared Cloud Edge)",
        "50 Bonus AI Credits Awal (Top-Up jika habis)",
        "Community Support"
      ]
    },
    { 
      name: "SaCMS Cloud Pro", 
      plan_slug: "pro", 
      price: 249000, 
      yearly_price: 1490000, 
      period: "bulan", 
      is_popular: true,
      description: "Paket lengkap all-inclusive untuk bisnis, media, dan startup modern (Tanpa Biaya Tersembunyi).", 
      max_content_types: 999999, 
      max_content_entries: 10000, 
      max_team_members: 10, 
      max_storage: 5120, 
      max_locales: 5,
      max_api_calls: 100000,
      fair_use_bandwidth_gb: 50,
      features: [
        "10.000 Entri Konten & Unlimited Schemas",
        "10 Anggota Tim & Kolaborasi Multi-Role",
        "5 GB Cloud Storage Media Assets",
        "100.000 API Requests / bulan",
        "Fair-Use Bandwidth ~50 GB/bulan (Shared Cloud Edge)",
        "500 AI Credits Awal (Top-Up untuk build lanjutan)",
        "🌐 Cloud Edge Global Hosting SUDAH TERMASUK (Rp 0 Tambahan)",
        "🏷️ GRATIS 1 Domain Kustom (.com / .id) Selama 1 Tahun",
        "Sertifikat SSL HTTPS Otomatis & Global Anycast CDN",
        "Prioritas Support & 99.9% SLA"
      ]
    },
    { 
      name: "SaCMS Cloud Business", 
      plan_slug: "business", 
      price: 490000, 
      yearly_price: 2900000, 
      period: "bulan", 
      is_popular: false,
      description: "Platform CMS andalan untuk korporasi, portal media nasional, dan traffic tinggi.", 
      max_content_types: 999999, 
      max_content_entries: 50000, 
      max_team_members: 25, 
      max_storage: 10240, 
      max_locales: 10,
      max_api_calls: 1000000,
      fair_use_bandwidth_gb: 250,
      features: [
        "50.000 Entri Konten & Unlimited Schemas",
        "25 Anggota Tim (Multi-Level Approvals & Workflow)",
        "10 GB Cloud Storage Media Assets",
        "1.000.000 API Requests / bulan",
        "Fair-Use Bandwidth ~250 GB/bulan (Shared Cloud Edge)",
        "1.500 AI Credits Awal (Top-Up untuk build lanjutan)",
        "🌐 Cloud Edge Global Hosting SUDAH TERMASUK (Rp 0 Ekstra)",
        "🏷️ GRATIS 1 Domain Premium (.go.id / .ac.id / .co.id / .com)",
        "Custom SMTP Mail Transporter & Audit Log Ekstensi",
        "24/7 Prioritas Support & SLA 99.9%"
      ]
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
        "Deploy 1-Klik ke SaCMS Cloud Hosting",
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
