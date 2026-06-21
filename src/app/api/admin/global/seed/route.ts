import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/database"

const GLOBAL_SLUG = "sacms-global"

const CONTENT_TYPES = [
  {
    slug: "sacms-hero",
    name: "SaCMS Hero Section",
    description: "Hero banner for the landing page",
    isSingleType: false,
    fields: [
      { slug: "headline",    name: "Headline",    type: "text",     required: true, order: 0 },
      { slug: "subheadline", name: "Subheadline", type: "text",     required: false, order: 1 },
      { slug: "cta_primary", name: "CTA Primary", type: "text",     required: false, order: 2 },
      { slug: "cta_secondary", name: "CTA Secondary", type: "text", required: false, order: 3 },
      { slug: "badge_text",  name: "Badge Text",  type: "text",     required: false, order: 4 },
      { slug: "image_url",   name: "Image URL",   type: "text",     required: false, order: 5 },
    ],
  },
  {
    slug: "sacms-features",
    name: "SaCMS Features",
    description: "Feature cards on landing page",
    isSingleType: false,
    fields: [
      { slug: "icon",        name: "Icon",        type: "text", required: false, order: 0 },
      { slug: "title",       name: "Title",       type: "text", required: true,  order: 1 },
      { slug: "description", name: "Description", type: "text", required: false, order: 2 },
      { slug: "color",       name: "Color",       type: "text", required: false, order: 3 },
    ],
  },
  {
    slug: "sacms-account-pricing",
    name: "SaCMS Account Plans",
    description: "Account tiers that govern workspace limits",
    isSingleType: false,
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
    slug: "sacms-workspace-pricing",
    name: "SaCMS Workspace Plans",
    description: "Pricing tiers for individual workspaces",
    isSingleType: false,
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
    slug: "sacms-addons",
    name: "SaCMS Addons",
    description: "Optional add-on services",
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
    description: "How-it-works workflow steps",
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
    description: "Frequently asked questions",
    isSingleType: false,
    fields: [
      { slug: "question", name: "Question", type: "text", required: true,  order: 0 },
      { slug: "answer",   name: "Answer",   type: "text", required: true,  order: 1 },
      { slug: "order",    name: "Order",    type: "number", required: false, order: 2 },
    ],
  },
  {
    slug: "sacms-testimonials",
    name: "SaCMS Testimonials",
    description: "Customer testimonials",
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
    description: "Team member profiles",
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
    description: "About section content (single)",
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
    description: "WhatsApp floating button config (single)",
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
  },
]

const COMPONENTS = [
  {
    slug: "seo-metadata",
    name: "SEO Metadata",
    description: "Standard SEO metadata fields",
    category: "shared",
    fields: [
      { slug: "meta_title", name: "Meta Title", type: "text", required: true, order: 0 },
      { slug: "meta_description", name: "Meta Description", type: "text", required: false, order: 1 },
      { slug: "meta_image", name: "Meta Image URL", type: "text", required: false, order: 2 },
      { slug: "keywords", name: "Keywords", type: "text", required: false, order: 3 },
    ]
  },
  {
    slug: "button-link",
    name: "Button Link",
    description: "Call to action button or link",
    category: "shared",
    fields: [
      { slug: "label", name: "Label", type: "text", required: true, order: 0 },
      { slug: "url", name: "URL", type: "text", required: true, order: 1 },
      { slug: "is_external", name: "Is External", type: "boolean", required: false, order: 2 },
      { slug: "variant", name: "Variant", type: "select", required: false, order: 3, options: { choices: ["primary", "secondary", "outline", "ghost"] } }
    ]
  },
  {
    slug: "image-with-caption",
    name: "Image with Caption",
    description: "Image with accessible alt text and caption",
    category: "media",
    fields: [
      { slug: "image_url", name: "Image URL", type: "text", required: true, order: 0 },
      { slug: "alt_text", name: "Alt Text", type: "text", required: true, order: 1 },
      { slug: "caption", name: "Caption", type: "text", required: false, order: 2 },
    ]
  },
  {
    slug: "author-profile",
    name: "Author Profile",
    description: "Author details for blog posts or articles",
    category: "content",
    fields: [
      { slug: "name", name: "Name", type: "text", required: true, order: 0 },
      { slug: "role", name: "Role", type: "text", required: false, order: 1 },
      { slug: "avatar_url", name: "Avatar URL", type: "text", required: false, order: 2 },
      { slug: "bio", name: "Bio", type: "text", required: false, order: 3 },
    ]
  }
]

const SEED_ENTRIES: Record<string, object[]> = {
  "sacms-hero": [
    {
      headline: "Modernisasi Digital untuk Tanah Papua",
      subheadline: "Platform CMS modern untuk membangun website pemerintah, portal berita, katalog UMKM, dan pariwisata di Papua. Dibangun dengan teknologi enterprise-grade untuk mendukung percepatan transformasi digital di Tanah Papua.",
      cta_primary: "Mulai Sekarang",
      cta_secondary: "Pelajari Selengkapnya",
      badge_text: "🏛️ Platform Digital Papua — Khusus Website Pemerintah",
      image_url: "",
    },
  ],
  "sacms-features": [
    { icon: "Shield", title: "Website Pemerintah", description: "Template dan sistem siap pakai untuk instansi pemerintah daerah di Papua. Mendukung transparansi informasi publik, pengumuman resmi, dan layanan masyarakat secara digital.", color: "indigo" },
    { icon: "Zap", title: "Portal Berita & Blog", description: "Sistem publikasi berita dan blog profesional untuk media lokal Papua. Dilengkapi kategori, penulis, penjadwalan publikasi, dan SEO otomatis.", color: "blue" },
    { icon: "Layout", title: "Katalog UMKM & Produk", description: "Etalase digital untuk wirausaha dan UMKM Papua. Tampilkan produk lokal, harga, dan informasi usaha kepada pasar yang lebih luas.", color: "purple" },
    { icon: "Globe", title: "Pariwisata Papua", description: "Showcase destinasi wisata dan kekayaan budaya Papua — dari Raja Ampat hingga Lembah Baliem. Website wisata yang memukau untuk menarik wisatawan.", color: "teal" },
    { icon: "CreditCard", title: "Profil Bisnis & Cafe", description: "Website profesional untuk usaha kecil dan menengah: cafe, restoran, toko, dan layanan jasa di seluruh Papua. Tampil modern dan mudah dikelola.", color: "yellow" },
    { icon: "Database", title: "Keamanan & Keandalan", description: "Infrastruktur enterprise-grade dengan enkripsi data, kontrol akses berbasis peran (RBAC), audit log, dan backup otomatis. Aman untuk data pemerintah dan bisnis.", color: "slate" },
  ],
  "sacms-account-pricing": [
    { 
      name: "Akun Gratis", plan_slug: "free", price: 0, yearly_price: 0, period: "selamanya", description: "Mulai tanpa biaya.", 
      max_workspaces: 1,
      features: ["1 Workspace", "Dukungan Komunitas"], is_popular: false, cta_text: "Mulai Gratis", cta_href: "/register" 
    },
    { 
      name: "Akun Pemula", plan_slug: "starter", price: 99000, yearly_price: 990000, period: "bulan", description: "Untuk tim kecil dan UMKM.", 
      max_workspaces: 3,
      features: ["3 Workspace", "Dukungan Email"], is_popular: false, cta_text: "Pilih Pemula", cta_href: "/register" 
    },
    { 
      name: "Akun Profesional", plan_slug: "pro", price: 299000, yearly_price: 2990000, period: "bulan", description: "Untuk instansi dan perusahaan.", 
      max_workspaces: 10,
      features: ["10 Workspace", "Dukungan Prioritas"], is_popular: true, cta_text: "Pilih Profesional", cta_href: "/register" 
    },
    { 
      name: "Akun Pemerintah", plan_slug: "enterprise", price: 999000, yearly_price: 9990000, period: "bulan", description: "Untuk instansi pemerintah.", 
      max_workspaces: 20,
      features: ["20 Workspace", "Dukungan Dedikasi", "SLA Khusus"], is_popular: false, cta_text: "Hubungi Kami", cta_href: "https://wa.me/6281234567890" 
    },
  ],
  "sacms-workspace-pricing": [
    { 
      name: "Workspace Gratis", plan_slug: "free", price: 0, yearly_price: 0, period: "selamanya", description: "Kapasitas dasar untuk memulai.", 
      max_content_types: 3, max_content_entries: 500, max_team_members: 1, max_storage: 100, max_locales: 1, max_api_calls: 1000,
      features: ["3 Tipe Konten", "1.000 Request API/bulan", "100MB Penyimpanan", "1 Anggota Tim"]
    },
    { 
      name: "Workspace Pemula", plan_slug: "starter", price: 49000, yearly_price: 490000, period: "bulan", description: "Kapasitas lebih untuk satu workspace.", 
      max_content_types: 5, max_content_entries: 5000, max_team_members: 3, max_storage: 1024, max_locales: 2, max_api_calls: 10000,
      features: ["5 Tipe Konten", "10.000 Request API/bulan", "1GB Penyimpanan", "3 Anggota Tim", "2 Bahasa"]
    },
    { 
      name: "Workspace Profesional", plan_slug: "pro", price: 149000, yearly_price: 1490000, period: "bulan", description: "Performa tinggi untuk instansi.", 
      max_content_types: 10, max_content_entries: 10000, max_team_members: 10, max_storage: 5120, max_locales: 5, max_api_calls: 100000,
      features: ["10 Tipe Konten", "100.000 Request API/bulan", "5GB Penyimpanan", "10 Anggota Tim", "5 Bahasa"]
    },
    { 
      name: "Workspace Pemerintah", plan_slug: "enterprise", price: 499000, yearly_price: 4990000, period: "bulan", description: "Workspace dedikasi untuk pemerintah.", 
      max_content_types: 20, max_content_entries: 20000, max_team_members: 20, max_storage: 10240, max_locales: 20, max_api_calls: 1000000,
      features: ["20 Tipe Konten", "1.000.000 Request API/bulan", "10GB Penyimpanan", "Tim Unlimited", "Bahasa Unlimited"]
    },
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
    { question: "Apakah data aman untuk instansi pemerintah?", answer: "Keamanan data adalah prioritas utama. SaCMS menggunakan enkripsi end-to-end, isolasi data per workspace, backup otomatis, dan infrastruktur cloud yang tersertifikasi.", order: 5 },
    { question: "Bisa digunakan untuk website pariwisata?", answer: "Tentu! SaCMS sangat cocok untuk website pariwisata dengan fitur galeri foto, peta lokasi, katalog destinasi, dan integrasi media sosial untuk mempromosikan keindahan Papua.", order: 6 },
  ],
  "sacms-testimonials": [
    { name: "Yohanes Wenda", role: "Kepala Bidang TIK", company: "Dinas Kominfo Papua", content: "SaCMS membantu kami membangun portal informasi pemerintah yang modern dan mudah dikelola. Transparansi informasi publik jadi lebih baik.", rating: 5, avatar_url: "https://i.pravatar.cc/150?u=papua-gov-1" },
    { name: "Maria Rumbekwan", role: "Pemilik UMKM", company: "Noken Papua Store", content: "Berkat SaCMS, produk kerajinan noken kami sekarang bisa dilihat dan dipesan dari seluruh Indonesia. Omzet naik 3x lipat!", rating: 5, avatar_url: "https://i.pravatar.cc/150?u=papua-umkm-1" },
    { name: "Daniel Fatem", role: "Pengelola Pariwisata", company: "Raja Ampat Tourism", content: "Website pariwisata kami tampil profesional dan memukau. Jumlah wisatawan yang menghubungi kami meningkat drastis sejak menggunakan SaCMS.", rating: 5, avatar_url: "https://i.pravatar.cc/150?u=papua-tourism-1" },
  ],
  "sacms-owners": [
    { name: "Zonggonau Cristoper", role: "Founder & Lead Architect", bio: "Seorang pengembang perangkat lunak yang berdedikasi untuk membangun ekosistem teknologi digital di Papua. Berpengalaman dalam merancang sistem skala besar yang efisien dan aman.", avatar_url: "https://api.dicebear.com/7.x/avataaars/svg?seed=Cristoper", linkedin: "https://linkedin.com/in/cristoperz" },
    { name: "Januar Fonda", role: "Core Developer", bio: "Pengembang Fullstack yang fokus pada performa dan skalabilitas sistem. Berkomitmen untuk menghadirkan pengalaman pengguna terbaik melalui teknologi modern.", avatar_url: "https://api.dicebear.com/7.x/avataaars/svg?seed=Januar", linkedin: "" },
  ],
  "sacms-about": [
    { title: "Tentang SaCMS", description: "SaCMS adalah platform CMS modern yang lahir dari visi untuk mempercepat transformasi digital di Tanah Papua. Kami membangun teknologi website yang mudah digunakan untuk instansi pemerintah, UMKM, media, dan sektor pariwisata di seluruh Papua.", mission: "Mewujudkan Papua Digital — membawa infrastruktur teknologi informasi kelas dunia untuk mendukung kemajuan pemerintahan, ekonomi, dan pariwisata di Tanah Papua.", founded: "2024" },
  ],
  "sacms-whatsapp": [
    { phone: "6282199220551", message: "Halo! Saya tertarik membangun website untuk instansi/UMKM di Papua menggunakan SaCMS. Bisakah saya mendapatkan informasi lebih lanjut?", label: "Hubungi Kami", is_active: true },
  ],
  "sacms-addons": [
    { icon: "Bot", name: "Paket AI Konten", description: "10.000 kredit tambahan untuk pembuatan konten otomatis dengan AI per bulan.", price: 49000, unit: "bulan" },
    { icon: "Database", name: "Penyimpanan Ekstra", description: "50GB tambahan penyimpanan untuk media, dokumen, dan aset digital.", price: 29000, unit: "bulan" },
    { icon: "Zap", name: "Boost API", description: "500.000 request API tambahan per bulan untuk website dengan trafik tinggi.", price: 39000, unit: "bulan" },
    { icon: "Shield", name: "Konsultasi Digital", description: "Konsultasi bulanan untuk strategi digitalisasi instansi dan UMKM di Papua.", price: 99000, unit: "bulan" },
  ],
  "sacms-sectors": [
    { icon: "Building", label: "Digital Agency", desc: "Kelola puluhan klien web" },
    { icon: "Code", label: "Solo Developer", desc: "Kurangi biaya server" },
    { icon: "ShoppingBag", label: "E-Commerce", desc: "Katalog headless" },
    { icon: "Briefcase", label: "SaaS Builders", desc: "Backend data terpusat" },
  ],
  "sacms-local-pride": [
    {
      badge: "Solusi B2B Terbaik",
      title: "Dibangun Untuk Menjawab Masalah Nyata Developer.",
      description: "Kami memahami betapa frustrasinya mengelola banyak instance CMS terpisah dan menagih klien. SaCMS hadir untuk merangkum semua infrastruktur tersebut menjadi satu panel kontrol elegan.",
    }
  ],
  "sacms-cta": [
    {
      title: "Siap Berhenti Melakukan Self-Host CMS?",
      description: "Pindahkan proyek klien Anda ke SaCMS. Skalabilitas tanpa batas, tanpa pusing.",
      button_primary_text: "Coba Gratis Sekarang",
      button_secondary_text: "Baca Dokumentasi API",
    }
  ],
  "sacms-footer": [
    {
      brand_name: "SaCMS",
      description: "The Ultimate Multi-Tenant Headless CMS for Modern Developers and Agencies.",
      copyright: "SaCMS. Hak cipta dilindungi.",
    }
  ],
}

export async function POST() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (session.user.role !== "super_admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const results: Record<string, { created: number; skipped: number }> = {}

    for (const ct of CONTENT_TYPES) {
      if (ct.isSingleType) {
        let singleType = await db.singleType.findFirst({
          where: { slug: ct.slug, tenantId: null },
        })

        if (!singleType) {
          singleType = await db.singleType.create({
            data: {
              name: ct.name,
              slug: ct.slug,
              description: ct.description,
              tenantId: null, // Truly Global
              isPublished: true,
              schemaFields: { create: ct.fields.map((f) => ({
                  name: f.name,
                  slug: f.slug,
                  type: f.type,
                  required: f.required,
                  order: f.order,
                })),
              },
            },
          })
        }

        const seedData = SEED_ENTRIES[ct.slug]
        if (!seedData || seedData.length === 0) {
          results[ct.slug] = { created: 0, skipped: 0 }
          continue
        }

        // Delete old assignment for fresh seed
        await db.tenantSingleTypeAssignment.deleteMany({
          where: { tenantId: null, singleTypeId: singleType.id },
        })

        await db.tenantSingleTypeAssignment.create({
          data: {
            tenantId: null, // Truly Global Data
            singleTypeId: singleType.id,
            data: seedData[0],
            publishedAt: new Date(),
          }
        })
        results[ct.slug] = { created: 1, skipped: 0 }
      } else {
        // Ensure content type exists
        let contentType = await db.contentType.findFirst({
          where: { slug: ct.slug, tenantId: null },
        })

        if (!contentType) {
          contentType = await db.contentType.create({
            data: {
              name: ct.name,
              slug: ct.slug,
              description: ct.description,
              tenantId: null, // Truly Global
              isPublished: true,
              schemaFields: { create: ct.fields.map((f) => ({
                  name: f.name,
                  slug: f.slug,
                  type: f.type,
                  required: f.required,
                  order: f.order,
                })),
              },
            },
          })
        }

        // Seed entries
        const seedData = SEED_ENTRIES[ct.slug]
        if (!seedData) {
          results[ct.slug] = { created: 0, skipped: 0 }
          continue
        }

        // Clear old entries
        await db.contentEntry.deleteMany({
          where: { tenantId: null, contentTypeId: contentType.id },
        })

        let created = 0
        for (const entryData of seedData) {
          await db.contentEntry.create({
            data: {
              tenantId: null, // Truly Global
              contentTypeId: contentType.id,
              status: "PUBLISHED",
              data: entryData,
              publishedAt: new Date(),
            },
          })
          created++
        }

        results[ct.slug] = { created, skipped: 0 }
      }
    }

    // === Seed Components ===
    for (const comp of COMPONENTS) {
      let component = await db.component.findFirst({
        where: { slug: comp.slug, tenantId: null },
      })

      if (!component) {
        component = await db.component.create({
          data: {
            name: comp.name,
            slug: comp.slug,
            description: comp.description,
            category: comp.category,
            tenantId: null, // Truly Global
            schemaFields: { create: comp.fields.map((f) => ({
                name: f.name,
                slug: f.slug,
                type: f.type,
                required: f.required,
                order: f.order,
                options: f.options as any,
              })),
            },
          },
        })
      }
      
      // Assign to global scope
      const existingAssignment = await db.tenantComponentAssignment.findFirst({
        where: { tenantId: null, componentId: component.id },
      })

      if (!existingAssignment) {
        await db.tenantComponentAssignment.create({
          data: {
            tenantId: null,
            componentId: component.id,
          }
        })
      }
    }

    // === Seed RBAC Permissions & RolePermissions ===
    const { PERMISSIONS } = await import("@/lib/rbac")

    const PERMISSION_DEFINITIONS = [
      { name: PERMISSIONS.CONTENT_READ, displayName: "Read Content", category: "content" },
      { name: PERMISSIONS.CONTENT_CREATE, displayName: "Create Content", category: "content" },
      { name: PERMISSIONS.CONTENT_UPDATE, displayName: "Update Content", category: "content" },
      { name: PERMISSIONS.CONTENT_DELETE, displayName: "Delete Content", category: "content" },
      { name: PERMISSIONS.MEDIA_READ, displayName: "Read Media", category: "media" },
      { name: PERMISSIONS.MEDIA_UPLOAD, displayName: "Upload Media", category: "media" },
      { name: PERMISSIONS.MEDIA_DELETE, displayName: "Delete Media", category: "media" },
      { name: PERMISSIONS.USER_INVITE, displayName: "Invite Users", category: "users" },
      { name: PERMISSIONS.USER_REMOVE, displayName: "Remove Users", category: "users" },
      { name: PERMISSIONS.SETTING_UPDATE, displayName: "Update Settings", category: "settings" },
      { name: PERMISSIONS.API_TOKEN_MANAGE, displayName: "Manage API Tokens", category: "api" },
    ]

    // 1. Seed Permissions
    for (const perm of PERMISSION_DEFINITIONS) {
      const existing = await db.permission.findUnique({ where: { name: perm.name } })
      if (!existing) {
        await db.permission.create({
          data: {
            name: perm.name,
            displayName: perm.displayName,
            category: perm.category,
            description: `Allows ${perm.displayName}`,
          }
        })
      }
    }

    // 2. Map standard roles to their permissions
    const DEFAULT_ROLES = {
      admin: Object.values(PERMISSIONS),
      editor: [
        PERMISSIONS.CONTENT_READ, PERMISSIONS.CONTENT_CREATE, PERMISSIONS.CONTENT_UPDATE, PERMISSIONS.CONTENT_DELETE,
        PERMISSIONS.MEDIA_READ, PERMISSIONS.MEDIA_UPLOAD, PERMISSIONS.MEDIA_DELETE,
      ],
      author: [
        PERMISSIONS.CONTENT_READ, PERMISSIONS.CONTENT_CREATE, PERMISSIONS.CONTENT_UPDATE,
        PERMISSIONS.MEDIA_READ, PERMISSIONS.MEDIA_UPLOAD,
      ],
      viewer: [
        PERMISSIONS.CONTENT_READ,
        PERMISSIONS.MEDIA_READ,
      ]
    }

    const allPerms = await db.permission.findMany()
    let rbacCreated = 0

    for (const [roleName, permNames] of Object.entries(DEFAULT_ROLES)) {
      for (const permName of permNames) {
        const permId = allPerms.find(p => p.name === permName)?.id
        if (!permId) continue

        // Check if exists globally (tenantId: null)
        const existing = await db.rolePermission.findFirst({
          where: {
            tenantId: null, // Global default
            roleId: roleName,
            permissionId: permId,
          }
        })

        if (!existing) {
          await db.rolePermission.create({
            data: {
              tenantId: null, // Global default applies to all tenants
              roleId: roleName,
              permissionId: permId,
              granted: true,
            }
          })
          rbacCreated++
        }
      }
    }
    return NextResponse.json({
      success: true,
      rbacCreated,
      results,
    })
  } catch (error) {
    console.error("Global seed error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}


export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (session.user.role !== "super_admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    // Check for global content types (those with tenantId: null)
    const contentTypes = await db.contentType.findMany({
      where: { tenantId: null },
      include: {
        entries: {
          where: { status: "PUBLISHED", tenantId: null },
          select: { id: true, status: true, createdAt: true },
        },
      },
    })

    const summary = contentTypes.map((ct) => ({
      slug: ct.slug,
      name: ct.name,
      publishedEntries: ct.entries.length,
    }))

    const hasData = summary.some(s => s.publishedEntries > 0)

    return NextResponse.json({
      exists: contentTypes.length > 0,
      hasData,
      contentTypes: summary,
    })
  } catch (error) {
    console.error("Global status error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
