export type Locale = "id" | "en"

/** Supported UI locales, in switcher order. */
export const LOCALES = ["id", "en"] as const
export const DEFAULT_LOCALE: Locale = "id"

export const LOCALE_LABELS: Record<Locale, string> = {
  id: "Bahasa Indonesia",
  en: "English",
}

export function isLocale(value: unknown): value is Locale {
  return value === "id" || value === "en"
}

export const BRAND = {
  name: "SaCMS",
  detail: "Smart Content Management System",
  slogan: "Build smarter. Manage easier. Scale faster.",
}

import { common } from "./locales/common"
import { errors } from "./locales/errors"
import { email } from "./locales/email"

const LANDING_DICTIONARY = {
  id: {
    brand: {
      name: "SaCMS",
      detail: "Smart Content Management System",
      slogan: "Build smarter. Manage easier. Scale faster.",
    },
    // Header & Navigation
    nav: {
      home: "Beranda",
      features: "Fitur",
      pricing: "Harga",
      about: "Tentang",
      docs: "Docs",
      blog: "Blog",
      login: "Masuk",
      getStarted: "Mulai Gratis",
      dashboard: "Buka Dashboard",
    },
    // Hero Section
    hero: {
      badge: "✨ SaCMS — Smart Content Management System",
      title: "Build smarter. Manage easier. Scale faster.",
      subtitle: "Platform Smart Content Management System (SaCMS) modern dengan Dedicated PostgreSQL 17 Appliance, AI Website Builder bawaan, Edge Custom DNS, Dynamic GraphQL, dan Billing Midtrans otomatis.",
      ctaPrimary: "Coba Gratis Sekarang",
      ctaSecondary: "Dokumentasi API",
      trustedBy: "Dipercaya oleh berbagai agensi, software house, media berita, dan instansi di seluruh Indonesia",
    },
    // Features Bento
    features: {
      badge: "Keunggulan Platform",
      title: "Dibangun untuk Skalabilitas, Kecepatan & Keamanan Maksimal",
      subtitle: "Arsitektur headless API-first yang memberi Anda kebebasan penuh untuk mendistribusikan konten ke berbagai platform.",
      items: {
        multiTenancy: {
          title: "Hybrid Multi-Tenancy & Dedicated Appliance",
          desc: "Mulai dari shared multi-tenant hemat biaya hingga PostgreSQL 17 + MinIO Appliance terisolasi penuh untuk privasi data absolut.",
        },
        aiBuilder: {
          title: "1-Prompt AI Fullstack Website Engine",
          desc: "Bangun landing page & website instan berbasis Next.js dengan AI prompt, preview interaktif, export kode, dan 1-click edge deploy.",
        },
        apiFirst: {
          title: "Dynamic GraphQL, REST API & MCP",
          desc: "Skema otomatis sesuai data model Anda, query filter canggih ala Strapi, dan integrasi AI IDE via Model Context Protocol (MCP).",
        },
        customDns: {
          title: "Vercel-Style Custom DNS & Registrar",
          desc: "Manajemen domain instan dengan verifikasi otomatis A-Record Apex, CNAME Subdomain, dan pencarian domain terintegrasi.",
        },
        billing: {
          title: "Billing Otomatis QRIS & Midtrans",
          desc: "Tagihan otomatis berbasis workspace dan akun (QRIS, VA, Kartu Kredit) dengan proteksi akses dan top-up kuota terintegrasi.",
        },
        workflow: {
          title: "Enterprise RBAC & 7-Stage Workflow",
          desc: "Kontrol hak akses tim bertingkat dan alur publikasi konten terstruktur (Draft -> In Review -> Scheduled -> Published) lengkap dengan audit log.",
        },
      },
    },
    // Sectors
    sectors: {
      badge: "Solusi Sektoral",
      title: "Disesuaikan untuk Berbagai Kebutuhan Industri",
      subtitle: "Dari solo developer, agensi digital, toko online modern, hingga portal digital pemerintah dan enterprise.",
      items: {
        agency: {
          title: "Digital Agency & Software House",
          desc: "Kelola puluhan website klien dari satu dasbor white-label tanpa pusing biaya server terpisah.",
        },
        gov: {
          title: "Pemerintah & BUMN",
          desc: "Keamanan database terisolasi (Gov VDS), kedaulatan data lokal, dan kepatuhan audit sistem.",
        },
        ecommerce: {
          title: "E-Commerce & Startup",
          desc: "Manajemen inventaris dinamis, API transaksi kilat, dan integrasi headless storefront modern.",
        },
        solo: {
          title: "Solo Builders & Developers",
          desc: "Luncurkan MVP dalam hitungan jam dengan paket ekonomis, visual schema builder, dan AI website assistant.",
        },
      },
    },
    // Pricing
    pricing: {
      badge: "Paket Workspace",
      title: "Pilihan Paket Fleksibel & Transparan",
      subtitle: "Mulai dari Cloud Ekonomis untuk UMKM hingga Dedicated Server (VPS & VDS) terisolasi penuh untuk perusahaan dan instansi pemerintah.",
      tabs: {
        all: "Semua",
        cloud: "Cloud SaaS",
        vps: "Cloud VPS",
        storage: "VPS Storage",
        vds: "Cloud VDS",
      },
      badges: {
        popular: "Paling Populer",
        dedicatedVps: "Dedicated VPS",
        dedicatedStorage: "Dedicated MinIO Storage",
        dedicatedVds: "100% Dedicated CPU",
      },
      period: {
        yearly: "/tahun",
        monthly: "/bulan",
        freeForever: "Gratis",
        monthlyEquivalent: "Setara",
        yearlyBilling: "(Tagihan Tahunan)",
      },
      cta: {
        free: "Mulai Gratis",
        paid: "Langganan Sekarang",
        current: "Paket Aktif",
      },
    },
    // Workflow
    workflow: {
      badge: "Cara Kerja",
      title: "Alur Kerja Super Cepat dalam 4 Langkah",
      subtitle: "Bangun dan publikasikan konten Anda dari ide hingga online dalam hitungan menit.",
      steps: [
        {
          step: 1,
          title: "Buat Workspace & Skema Konten",
          desc: "Tentukan struktur data sesuai kebutuhan Anda melalui visual schema builder.",
        },
        {
          step: 2,
          title: "Tulis & Kolaborasi dengan Tim",
          desc: "Buat artikel, produk, atau halaman dengan dukungan AI Content Generator.",
        },
        {
          step: 3,
          title: "Publikasi via Multi-Channel API",
          desc: "Distribusikan konten ke Web Next.js, Mobile App iOS/Android, atau IoT secara realtime.",
        },
        {
          step: 4,
          title: "Pantau Traffic & Analitik",
          desc: "Lacak performa API, kuota penggunaan, dan log audit keamanan dalam satu dashboard.",
        },
      ],
    },
    // Addons
    addons: {
      badge: "Ekstra & Booster",
      title: "Tingkatkan Kapasitas Sesuai Kebutuhan",
      subtitle: "Paket top-up kuota AI, penyimpanan S3, dan API calls tambahan tanpa perlu upgrade tier.",
      cta: "Top Up Sekarang",
    },
    // Testimonials
    testimonials: {
      badge: "Testimoni",
      title: "Apa Kata Para Pengembang & Bisnis",
      subtitle: "Cerita nyata dari tim yang mempercepat peluncuran produk mereka bersama SaCMS.",
    },
    // About
    about: {
      badge: "Tentang SaCMS",
      title: "Smart Content Management System",
      desc1: "SaCMS (Smart Content Management System) lahir dengan misi: 'Build smarter. Manage easier. Scale faster.' Kami mendemokratisasi teknologi enterprise-grade untuk seluruh pengembang, bisnis, dan instansi.",
      desc2: "Dibangun dengan arsitektur headless modern, kami memastikan setiap data terkelola dengan aman, terisolasi, dan berkinerja maksimal.",
    },
    // Team
    team: {
      badge: "Tim Pengembang",
      title: "Dibuat dengan Dedikasi untuk Indonesia",
      subtitle: "Para insinyur perangkat lunak dan arsitek cloud yang berkomitmen membangun infrastruktur digital terbaik.",
    },
    // FAQ
    faq: {
      badge: "Pertanyaan Umum",
      title: "Semua yang Perlu Anda Ketahui",
      subtitle: "Pertanyaan yang sering diajukan seputar platform, keamanan, dan metode pembayaran.",
      items: [
        {
          q: "Apa itu SaCMS (Smart Content Management System)?",
          a: "SaCMS adalah Smart Content Management System headless multi-tenant modern berbasis Next.js 16 dan PostgreSQL 17. SaCMS memisahkan penyimpanan data dari frontend untuk memberikan kebebasan penuh dalam mendistribusikan konten.",
        },
        {
          q: "Bagaimana cara kerja Dedicated VPS/VDS?",
          a: "Saat Anda berlangganan paket Cloud VPS atau Gov VDS, sistem kami secara otomatis mem-provisioning server cloud terisolasi dengan database PostgreSQL 17, Object Storage S3, dan hosting frontend khusus untuk workspace Anda.",
        },
        {
          q: "Metode pembayaran apa saja yang didukung?",
          a: "Kami mendukung seluruh pembayaran lokal via Midtrans: QRIS, GoPay, OVO, ShopeePay, Transfer Bank (BCA, Mandiri, BNI, BRI, Permata), dan Kartu Kredit Visa/Mastercard.",
        },
        {
          q: "Apakah saya bisa menggunakan database PostgreSQL saya sendiri (BYODB)?",
          a: "Ya! Anda dapat memasukkan string koneksi PostgreSQL Anda sendiri (seperti Supabase, Neon, AWS RDS) langsung di menu Pengaturan Workspace.",
        },
      ],
    },
    // Blog
    blog: {
      badge: "Blog & Wawasan Terkini",
      title: "Wawasan Teknis & Arsitektur SaCMS",
      subtitle: "Panduan praktis, arsitektur multi-tenant, dan strategi pengembangan headless CMS modern.",
      viewAll: "Lihat Semua Artikel",
      readMore: "Baca",
    },
    // CTA Banner
    cta: {
      title: "Build smarter. Manage easier. Scale faster.",
      description: "Daftar sekarang di SaCMS (Smart Content Management System) dan nikmati kemudahan mengelola konten multi-tenant dengan teknologi kelas dunia.",
      buttonPrimary: "Mulai Gratis Sekarang",
      buttonSecondary: "Hubungi Penjualan",
    },
    // Footer
    footer: {
      brandDesc: "SaCMS — Smart Content Management System. Build smarter. Manage easier. Scale faster. Platform SaaS Headless CMS terdepan untuk transformasi digital.",
      rights: "Hak cipta dilindungi undang-undang. Smart Content Management System.",
      sections: {
        product: "Produk",
        resources: "Sumber Daya",
        company: "Perusahaan",
        legal: "Legalitas",
      },
      links: {
        features: "Fitur Unggulan",
        pricing: "Daftar Harga",
        docs: "Dokumentasi API",
        status: "Status Server",
        blog: "Blog & Wawasan",
        about: "Tentang Kami",
        privacy: "Kebijakan Privasi",
        terms: "Syarat & Ketentuan",
        security: "Keamanan",
      },
    },
  },
  en: {
    brand: {
      name: "SaCMS",
      detail: "Smart Content Management System",
      slogan: "Build smarter. Manage easier. Scale faster.",
    },
    nav: {
      home: "Home",
      features: "Features",
      pricing: "Pricing",
      about: "About",
      docs: "Docs",
      blog: "Blog",
      login: "Sign In",
      getStarted: "Get Started Free",
      dashboard: "Open Dashboard",
    },
    hero: {
      badge: "✨ SaCMS — Smart Content Management System",
      title: "Build smarter. Manage easier. Scale faster.",
      subtitle: "SaCMS (Smart Content Management System) is an enterprise-grade multi-tenant Headless CMS with Dedicated PostgreSQL 17 Appliance, AI Website Builder, Edge Custom DNS, and Dynamic GraphQL.",
      ctaPrimary: "Get Started Free",
      ctaSecondary: "API Documentation",
      trustedBy: "Trusted by top digital agencies, software houses, news media, and government agencies",
    },
    features: {
      badge: "Platform Capabilities",
      title: "Built for Maximum Scalability, Speed & Security",
      subtitle: "Modern API-first headless architecture giving you complete freedom to distribute content everywhere.",
      items: {
        multiTenancy: {
          title: "Hybrid Multi-Tenancy & Dedicated Appliance",
          desc: "From shared multi-tenant clusters to dedicated PostgreSQL 17 + MinIO appliances for absolute privacy.",
        },
        aiBuilder: {
          title: "1-Prompt AI Fullstack Website Engine",
          desc: "Generate Next.js websites and landing pages with AI prompt, live interactive preview, and 1-click edge deploy.",
        },
        apiFirst: {
          title: "Dynamic GraphQL, REST API & MCP",
          desc: "Auto-generated schemas, Strapi-style filtering, and Model Context Protocol (MCP) bridge for AI agents.",
        },
        customDns: {
          title: "Vercel-Style Custom DNS & Registrar",
          desc: "Instant custom domain verification with automatic A-Record Apex, CNAME Subdomain, and SSL certificates.",
        },
        billing: {
          title: "Automated Billing & Subscriptions",
          desc: "Automated billing with Midtrans (QRIS, VA, Cards) and integrated quota credit system.",
        },
        workflow: {
          title: "Enterprise RBAC & 7-Stage Workflow",
          desc: "Granular role-based permissions and structured publishing workflow with comprehensive audit logging.",
        },
      },
    },
    sectors: {
      badge: "Sector Solutions",
      title: "Tailored for Every Industry Requirement",
      subtitle: "From solo builders and digital agencies to modern e-commerce and enterprise government portals.",
      items: {
        agency: {
          title: "Digital Agency & Software House",
          desc: "Manage multiple client sites from one white-label dashboard without server management overhead.",
        },
        gov: {
          title: "Government & Enterprise",
          desc: "Isolated dedicated database, local data sovereignty compliance, and comprehensive audit logs.",
        },
        ecommerce: {
          title: "E-Commerce & Startup",
          desc: "Dynamic product catalogs, lightning-fast APIs, and modern headless storefront integrations.",
        },
        solo: {
          title: "Solo Builders & Developers",
          desc: "Ship MVPs in hours with visual schema builder, starter kits, and AI website generation.",
        },
      },
    },
    pricing: {
      badge: "Workspace Plans",
      title: "Transparent & Flexible Pricing",
      subtitle: "From affordable cloud tiers to 100% dedicated VPS and VDS servers for enterprises.",
      tabs: {
        all: "All",
        cloud: "Cloud SaaS",
        vps: "Cloud VPS",
        storage: "VPS Storage",
        vds: "Cloud VDS",
      },
      badges: {
        popular: "Most Popular",
        dedicatedVps: "Dedicated VPS",
        dedicatedStorage: "Dedicated MinIO Storage",
        dedicatedVds: "100% Dedicated CPU",
      },
      period: {
        yearly: "/year",
        monthly: "/month",
        freeForever: "Free",
        monthlyEquivalent: "Equiv.",
        yearlyBilling: "(Billed Annually)",
      },
      cta: {
        free: "Start Free",
        paid: "Subscribe Now",
        current: "Current Plan",
      },
    },
    workflow: {
      badge: "How It Works",
      title: "Fast Workflow in 4 Simple Steps",
      subtitle: "Design and publish content from idea to live production in minutes.",
      steps: [
        {
          step: 1,
          title: "Create Workspace & Content Schema",
          desc: "Define your data structure visually with our drag-and-drop schema builder.",
        },
        {
          step: 2,
          title: "Author & Collaborate with Team",
          desc: "Create articles, products, or pages with AI Content Generator assistance.",
        },
        {
          step: 3,
          title: "Publish via Multi-Channel API",
          desc: "Deliver content to Next.js web apps, mobile apps, or IoT devices in realtime.",
        },
        {
          step: 4,
          title: "Monitor Traffic & Analytics",
          desc: "Track API latency, usage quotas, and security audit logs in one central hub.",
        },
      ],
    },
    addons: {
      badge: "Addons & Boosters",
      title: "Expand Capacity On-Demand",
      subtitle: "Top-up AI credits, S3 storage, and API rate limits without upgrading tiers.",
      cta: "Top Up Now",
    },
    testimonials: {
      badge: "Testimonials",
      title: "What Developers & Businesses Say",
      subtitle: "Real stories from teams accelerating production delivery with SaCMS.",
    },
    about: {
      badge: "About SaCMS",
      title: "Smart Content Management System",
      desc1: "SaCMS (Smart Content Management System) is built on the motto: 'Build smarter. Manage easier. Scale faster.' We democratize enterprise headless technology for everyone.",
      desc2: "Engineered with modern headless architecture, ensuring your data is secure, isolated, and highly performant.",
    },
    team: {
      badge: "Engineering Team",
      title: "Built with Dedication",
      subtitle: "Software engineers and cloud architects committed to building world-class digital infrastructure.",
    },
    faq: {
      badge: "FAQ",
      title: "Frequently Asked Questions",
      subtitle: "Common answers regarding our platform, architecture, and security.",
      items: [
        {
          q: "What is SaCMS (Smart Content Management System)?",
          a: "SaCMS is a modern, AI-native multi-tenant Headless CMS built on Next.js 16 and PostgreSQL 17. It decouples content storage from frontend presentation.",
        },
        {
          q: "How does Dedicated VPS/VDS appliance work?",
          a: "When subscribing to Cloud VPS or Gov VDS, our infrastructure orchestrator provisions an isolated cloud instance with PostgreSQL 17, MinIO S3, and Next.js hosting for your workspace.",
        },
        {
          q: "What payment methods are supported?",
          a: "We support major payment methods including QRIS, e-Wallets, Bank Transfer (VA), and Credit Cards.",
        },
        {
          q: "Can I bring my own PostgreSQL database (BYODB)?",
          a: "Yes! You can connect your external PostgreSQL instance (e.g. Supabase, Neon, AWS RDS) directly in Workspace Settings.",
        },
      ],
    },
    // Blog
    blog: {
      badge: "Latest Blog & Insights",
      title: "Technical Insights & SaCMS Architecture",
      subtitle: "Practical guides, multi-tenant architecture, and modern headless CMS development strategies.",
      viewAll: "View All Articles",
      readMore: "Read",
    },
    cta: {
      title: "Build smarter. Manage easier. Scale faster.",
      description: "Sign up today on SaCMS (Smart Content Management System) and experience modern multi-tenant content delivery.",
      buttonPrimary: "Get Started Free",
      buttonSecondary: "Contact Sales",
    },
    footer: {
      brandDesc: "SaCMS — Smart Content Management System. Build smarter. Manage easier. Scale faster. The leading enterprise Headless CMS.",
      rights: "All rights reserved. Smart Content Management System.",
      sections: {
        product: "Product",
        resources: "Resources",
        company: "Company",
        legal: "Legal",
      },
      links: {
        features: "Features",
        pricing: "Pricing",
        docs: "API Docs",
        status: "System Status",
        blog: "Blog & Insights",
        about: "About Us",
        privacy: "Privacy Policy",
        terms: "Terms of Service",
        security: "Security",
      },
    },
  },
}

/**
 * Recursively widens literal types to their base (`"Save"` -> `string`,
 * `1` -> `number`) so the type constraint below checks *shape*, not exact
 * wording — the whole point is that `id` and `en` have different words.
 */
type Widen<T> = T extends string
  ? string
  : T extends number
    ? number
    : T extends boolean
      ? boolean
      : T extends readonly (infer U)[]
        ? Widen<U>[]
        : { [K in keyof T]: Widen<T[K]> }

/**
 * The full per-locale dictionary: landing namespaces + the cross-cutting
 * ones (common, errors, email).
 *
 * `Dict` is derived from the `id` tree (widened), and the object below is
 * annotated `Record<Locale, Dict>`, so if the `en` side ever drifts — a
 * missing key, a wrong shape — it's a compile error, not empty text in
 * production.
 */
export type Dict = Widen<
  typeof LANDING_DICTIONARY["id"] & {
    common: typeof common["id"]
    errors: typeof errors["id"]
    email: typeof email["id"]
  }
>

export const DICTIONARY: Record<Locale, Dict> = {
  id: {
    ...LANDING_DICTIONARY.id,
    common: common.id,
    errors: errors.id,
    email: email.id,
  },
  en: {
    ...LANDING_DICTIONARY.en,
    common: common.en,
    errors: errors.en,
    email: email.en,
  },
}
