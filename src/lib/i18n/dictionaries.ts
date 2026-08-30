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
      badge: "🚀 Next.js 16 Multi-Tenant Headless Engine",
      title: "Hentikan Kerumitan Mengelola Puluhan CMS & Server Terpisah",
      subtitle: "Platform Headless CMS multi-tenant modern dengan Dedicated PostgreSQL 17 Appliance, AI Website Builder bawaan, Edge Custom DNS, Dynamic GraphQL, dan Billing Midtrans otomatis.",
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
    },
  },
  en: {} as any,
}

// Fallback EN to ID for safety
DICTIONARY.en = DICTIONARY.id

