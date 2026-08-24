export type Locale = "id" | "en"

export const DICTIONARY = {
  id: {
    // Header & Navigation
    nav: {
      home: "Beranda",
      features: "Fitur",
      pricing: "Harga",
      about: "Tentang",
      docs: "Dokumentasi",
      blog: "Blog",
      login: "Masuk",
      getStarted: "Mulai Gratis",
      dashboard: "Buka Dashboard",
    },
    // Hero Section
    hero: {
      badge: "SaaS Headless CMS Multi-Tenant #1 Indonesia",
      title: "Solusi Konten Digital Modern untuk Agensi, UMKM & Pemerintahan",
      subtitle: "Platform CMS multi-tenant tercepat berbasis Next.js 16. Dilengkapi AI-powered content builder, billing Midtrans otomatis, dan Dedicated Cloud VPS/VDS terisolasi.",
      ctaPrimary: "Coba Gratis Sekarang",
      ctaSecondary: "Pelajari Fitur",
      trustedBy: "Dipercaya oleh berbagai agensi, media berita, dan instansi di seluruh Indonesia",
    },
    // Features Bento
    features: {
      badge: "Keunggulan Platform",
      title: "Dibangun untuk Skalabilitas, Kecepatan & Keamanan Maksimal",
      subtitle: "Arsitektur headless API-first yang memberi Anda kebebasan penuh untuk mendistribusikan konten ke berbagai platform.",
      items: {
        apiFirst: {
          title: "API-First & GraphQL Dinamis",
          desc: "Akses konten via REST API dan GraphQL otomatis dengan response time super cepat di bawah 50ms.",
        },
        multiTenancy: {
          title: "Multi-Tenancy Asli",
          desc: "Kelola ratusan workspace, situs klien, dan subdomain dalam satu panel kontrol terpusat.",
        },
        visualEditor: {
          title: "Visual Schema & Content Builder",
          desc: "Rancang tipe data, relasi skema, dan draft konten dengan antarmuka visual intuitif tanpa perlu menulis kode.",
        },
        dedicatedInfra: {
          title: "Infrastruktur Dedicated Terisolasi",
          desc: "Otomatisasi Dedicated PostgreSQL 17 + MinIO S3 Object Storage + Caddy Auto-SSL pada Cloud VPS/VDS.",
        },
        mediaStorage: {
          title: "Penyimpanan Media S3 & Cloudflare R2",
          desc: "Optimasi gambar otomatis WebP/AVIF dengan CDN global super cepat dan biaya penyimpanan sangat efisien.",
        },
        billing: {
          title: "Billing Otomatis QRIS & Midtrans",
          desc: "Dukungan pembayaran lokal lengkap: QRIS, GoPay, OVO, ShopeePay, Virtual Account, dan Kartu Kredit.",
        },
      },
    },
    // Sectors
    sectors: {
      badge: "Solusi Sektoral",
      title: "Disesuaikan untuk Berbagai Kebutuhan Industri",
      subtitle: "Dari website personal, toko online, portal media berita bertrafik jutaan, hingga portal digital pemerintah.",
      items: {
        umkm: {
          title: "UMKM & Bisnis Lokal",
          desc: "Katalog produk online, landing page promosi, dan profil bisnis yang cepat dan hemat biaya.",
        },
        media: {
          title: "Portal Berita & Media",
          desc: "Manajemen artikel multi-penulis, optimasi SEO instan, dan performa tinggi untuk jutaan pembaca.",
        },
        ecommerce: {
          title: "E-Commerce & Startup",
          desc: "Manajemen inventaris dinamis, API transaksi, dan integrasi headless storefront modern.",
        },
        gov: {
          title: "Pemerintah & BUMN",
          desc: "Keamanan data level tinggi, isolasi CPU fisik dedicated 100%, dan audit log lengkap.",
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
        cloud: "Cloud Ekonomis",
        businessVps: "Business VPS",
        govVds: "Gov & Enterprise VDS",
      },
      badges: {
        popular: "Paling Populer",
        dedicatedVps: "Dedicated VPS",
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
      title: "Menghubungkan Indonesia Melalui Transformasi Digital",
      desc1: "SaCMS lahir dengan misi mendemokratisasi teknologi enterprise-grade untuk seluruh lapisan masyarakat, dari pengusaha UMKM hingga instansi pemerintah.",
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
          q: "Apa itu Headless CMS?",
          a: "Headless CMS adalah sistem manajemen konten berbasis API yang memisahkan tempat penyimpanan konten dari tampilan frontend. Ini memberi Anda kebebasan menampilkan konten di website Next.js, aplikasi mobile, jam tangan pintar, atau platform apa pun.",
        },
        {
          q: "Bagaimana cara kerja Dedicated VPS/VDS?",
          a: "Saat Anda berlangganan paket Business VPS atau Gov VDS, sistem kami secara otomatis mem-provisioning server cloud di Contabo dengan database PostgreSQL 17 dan MinIO S3 terisolasi penuh khusus untuk workspace Anda.",
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
    // CTA Banner
    cta: {
      title: "Siap Memulai Transformasi Digital Anda?",
      description: "Daftar sekarang dan nikmati kemudahan mengelola konten multi-tenant dengan teknologi kelas dunia.",
      buttonPrimary: "Mulai Gratis Sekarang",
      buttonSecondary: "Hubungi Penjualan",
    },
    // Footer
    footer: {
      brandDesc: "Platform SaaS Headless CMS Multi-Tenant terdepan untuk transformasi digital Indonesia.",
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
      rights: "Hak Cipta Dilindungi.",
    },
  },
  en: {
    // Header & Navigation
    nav: {
      home: "Home",
      features: "Features",
      pricing: "Pricing",
      about: "About",
      docs: "Documentation",
      blog: "Blog",
      login: "Sign In",
      getStarted: "Get Started Free",
      dashboard: "Go to Dashboard",
    },
    // Hero Section
    hero: {
      badge: "#1 Enterprise Multi-Tenant Headless CMS",
      title: "Modern Digital Content Infrastructure for Agencies, SMBs & Government",
      subtitle: "The fastest multi-tenant CMS built on Next.js 16. Featuring AI-powered content generation, native automated billing, and isolated Dedicated Cloud VPS & VDS.",
      ctaPrimary: "Try for Free Today",
      ctaSecondary: "Explore Features",
      trustedBy: "Trusted by forward-thinking digital agencies, media publishers, and enterprises nationwide",
    },
    // Features Bento
    features: {
      badge: "Platform Highlights",
      title: "Engineered for Extreme Scalability, Speed & Security",
      subtitle: "An API-first headless architecture giving you total freedom to deliver rich content across any digital channel.",
      items: {
        apiFirst: {
          title: "API-First & Dynamic GraphQL",
          desc: "Query your content seamlessly via REST and dynamic GraphQL with ultra-fast sub-50ms response times.",
        },
        multiTenancy: {
          title: "Native Multi-Tenancy",
          desc: "Manage hundreds of client workspaces, custom domains, and isolated environments from a single unified hub.",
        },
        visualEditor: {
          title: "Visual Schema & Content Studio",
          desc: "Design custom data schemas, relational models, and interactive content with a zero-code visual interface.",
        },
        dedicatedInfra: {
          title: "Dedicated Isolated Infrastructure",
          desc: "Automated zero-touch provisioning: Dedicated PostgreSQL 17 + MinIO S3 Storage + Auto Let's Encrypt SSL.",
        },
        mediaStorage: {
          title: "S3 & Cloudflare R2 Media Storage",
          desc: "Automated WebP/AVIF media optimization backed by a high-speed global CDN with predictable low costs.",
        },
        billing: {
          title: "Automated Gateway & Invoicing",
          desc: "Seamless support for instant local payments: QRIS, E-Wallets, Virtual Accounts, and Global Credit Cards.",
        },
      },
    },
    // Sectors
    sectors: {
      badge: "Sector Solutions",
      title: "Tailored for Diverse Industry Demands",
      subtitle: "From personal portfolio sites and online stores to high-traffic news portals and mission-critical government platforms.",
      items: {
        umkm: {
          title: "SMBs & Local Businesses",
          desc: "Cost-effective product catalogs, promotional landing pages, and fast digital business profiles.",
        },
        media: {
          title: "News & Media Publishing",
          desc: "Multi-author publishing workflows, instant SEO optimization, and rock-solid uptime for millions of readers.",
        },
        ecommerce: {
          title: "E-Commerce & Startups",
          desc: "Dynamic inventory management, secure transaction APIs, and headless storefront integrations.",
        },
        gov: {
          title: "Government & Enterprise",
          desc: "High-grade compliance, 100% dedicated physical CPU locking, and exhaustive audit trail logging.",
        },
      },
    },
    // Pricing
    pricing: {
      badge: "Workspace Pricing",
      title: "Transparent & Flexible Plans for Every Scale",
      subtitle: "From affordable multi-tenant cloud tiers for SMBs to fully isolated Dedicated Servers (VPS & VDS) for enterprises and public agencies.",
      tabs: {
        all: "All Plans",
        cloud: "Economic Cloud",
        businessVps: "Business VPS",
        govVds: "Gov & Enterprise VDS",
      },
      badges: {
        popular: "Most Popular",
        dedicatedVps: "Dedicated VPS",
        dedicatedVds: "100% Dedicated CPU",
      },
      period: {
        yearly: "/year",
        monthly: "/month",
        freeForever: "Free",
        monthlyEquivalent: "Equivalent to",
        yearlyBilling: "(Billed Annually)",
      },
      cta: {
        free: "Start for Free",
        paid: "Subscribe Now",
        current: "Active Plan",
      },
    },
    // Workflow
    workflow: {
      badge: "How It Works",
      title: "Supercharged 4-Step Publishing Workflow",
      subtitle: "Build, curate, and ship digital experiences from concept to live production in minutes.",
      steps: [
        {
          step: 1,
          title: "Create Workspace & Schemas",
          desc: "Define your bespoke content models and relational fields using the visual schema studio.",
        },
        {
          step: 2,
          title: "Craft Content with Team & AI",
          desc: "Write engaging articles, manage products, and collaborate in real-time with integrated AI writing assistants.",
        },
        {
          step: 3,
          title: "Publish Across Multi-Channel APIs",
          desc: "Stream content to Next.js apps, iOS/Android mobile clients, or IoT devices in real-time.",
        },
        {
          step: 4,
          title: "Monitor Traffic & Audit Logs",
          desc: "Track API latency, team member activities, and quota consumption from a single dashboard.",
        },
      ],
    },
    // Addons
    addons: {
      badge: "Add-ons & Boosters",
      title: "Scale Resources on Demand",
      subtitle: "One-time top-ups for extra AI tokens, S3 storage, and burst API request limits without changing your subscription tier.",
      cta: "Top Up Now",
    },
    // Testimonials
    testimonials: {
      badge: "Testimonials",
      title: "Loved by Developers & Business Leaders",
      subtitle: "Real stories from engineering teams who accelerated their delivery pipelines with SaCMS.",
    },
    // About
    about: {
      badge: "About SaCMS",
      title: "Empowering Digital Transformation at National Scale",
      desc1: "SaCMS was built to democratize enterprise-grade content management for everyone, from growing local businesses to large public institutions.",
      desc2: "Built on a resilient headless architecture, we guarantee your data remains secure, isolated, and accessible with optimal throughput.",
    },
    // Team
    team: {
      badge: "Core Engineering Team",
      title: "Crafted with Passion for Digital Excellence",
      subtitle: "Software engineers and cloud architects dedicated to building resilient, modern digital infrastructure.",
    },
    // FAQ
    faq: {
      badge: "Frequently Asked Questions",
      title: "Everything You Need to Know",
      subtitle: "Answers to common questions regarding architecture, security, and flexible payment gateways.",
      items: [
        {
          q: "What is a Headless CMS?",
          a: "A Headless CMS is an API-first content management system that decouples the backend database from the presentation layer. This lets you display content on Next.js websites, mobile apps, smartwatches, or any frontend framework.",
        },
        {
          q: "How does Dedicated VPS/VDS provisioning work?",
          a: "When you subscribe to a Business VPS or Gov VDS plan, our automated system provisions a dedicated cloud server with PostgreSQL 17 and MinIO S3 object storage fully isolated for your workspace.",
        },
        {
          q: "Which payment methods are supported?",
          a: "We support automated Indonesian and international payment methods via Midtrans: QRIS, GoPay, OVO, ShopeePay, Virtual Accounts (BCA, Mandiri, BNI, BRI), and Visa/Mastercard Credit Cards.",
        },
        {
          q: "Can I connect my own custom database (BYODB)?",
          a: "Yes! You can connect your external PostgreSQL database URL (e.g. Supabase, Neon, AWS RDS, GCP Cloud SQL) directly in your Workspace Settings.",
        },
      ],
    },
    // CTA Banner
    cta: {
      title: "Ready to Accelerate Your Digital Platform?",
      description: "Join thousands of builders leveraging world-class multi-tenant headless CMS technology.",
      buttonPrimary: "Get Started Free",
      buttonSecondary: "Contact Sales",
    },
    // Footer
    footer: {
      brandDesc: "Leading Enterprise Multi-Tenant Headless CMS platform for seamless digital transformation.",
      sections: {
        product: "Product",
        resources: "Resources",
        company: "Company",
        legal: "Legal",
      },
      links: {
        features: "Core Features",
        pricing: "Pricing Plans",
        docs: "API Documentation",
        status: "System Status",
        blog: "Blog & Insights",
        about: "About Us",
        privacy: "Privacy Policy",
        terms: "Terms of Service",
        security: "Security Overview",
      },
      rights: "All Rights Reserved.",
    },
  },
}
