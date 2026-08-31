export const DEFAULT_LANDING_PAGE_DATA: any = {
  "sacms-hero": {
    "headline": "Build smarter. Manage easier. Scale faster.",
    "subheadline": "SaCMS (Smart Content Management System) adalah platform Headless CMS multi-tenant modern dengan Dedicated PostgreSQL 17 Appliance, 1-Prompt AI Fullstack Website Engine, Edge Custom DNS, Dynamic GraphQL, dan Billing Midtrans otomatis.",
    "cta_primary": "Coba Gratis Sekarang",
    "cta_secondary": "Lihat Dokumentasi",
    "badge_text": "",
    "image_url": ""
  },
  "sacms-features": [
    {
      "icon": "Shield",
      "title": "Isolasi Data Absolut",
      "description": "Arsitektur multi-tenant murni di level database. Tidak ada lagi risiko kebocoran data antar klien atau setup instance terpisah yang mahal.",
      "color": "indigo"
    },
    {
      "icon": "CreditCard",
      "title": "Billing Midtrans Otomatis",
      "description": "Monetisasi layanan CMS Anda langsung ke klien. Integrasi Midtrans Snap API bawaan untuk tagihan berlangganan otomatis.",
      "color": "blue"
    },
    {
      "icon": "Zap",
      "title": "Edge-Optimized API",
      "description": "Waktu respons API Publik di bawah 200ms dengan caching Upstash Redis. Hilangkan masalah waterfall request di frontend.",
      "color": "teal"
    },
    {
      "icon": "Database",
      "title": "Schema Builder Dinamis",
      "description": "Buat struktur database kompleks (Collection & Single Types) tanpa coding, langsung dari antarmuka visual yang modern.",
      "color": "slate"
    },
    {
      "icon": "Cloud",
      "title": "Cloudflare R2 Media",
      "description": "Penyimpanan aset digital terdistribusi CDN tanpa membebani database utama. Dilengkapi auto-thumbnail generation.",
      "color": "purple"
    },
    {
      "icon": "Webhook",
      "title": "Sinkronisasi Webhook",
      "description": "Hubungkan CMS ke berbagai platform frontend Anda dengan Webhook asinkron dan sistem antrian gagal (Dead Letter Queue).",
      "color": "pink"
    },
    {
      "icon": "Users",
      "title": "Granular Role-Based Access",
      "description": "Atur izin akses untuk klien (Owner, Admin, Editor) untuk membatasi fitur modifikasi skema atau penagihan sesuai kebutuhan.",
      "color": "yellow"
    },
    {
      "icon": "Search",
      "title": "Full-Text Search & Filter",
      "description": "REST API & GraphQL dilengkapi operator filter dinamis dan dukungan pencarian teks penuh (FTS) secara bawaan.",
      "color": "orange"
    }
  ],
  "sacms-workflow": [
    {
      "step": 1,
      "title": "Daftar Akun",
      "description": "Buat akun Anda secara gratis dan dapatkan akses penuh ke panel kontrol Super Admin SaCMS.",
      "icon": "UserPlus"
    },
    {
      "step": 2,
      "title": "Buat Workspace",
      "description": "Tambahkan workspace baru untuk setiap proyek klien. Batasi akses dan pantau pemakaian API secara real-time.",
      "icon": "Building"
    },
    {
      "step": 3,
      "title": "Rancang Skema",
      "description": "Buat Content Type dinamis dan undang klien Anda untuk mulai mengisi data via dashboard interaktif.",
      "icon": "Database"
    },
    {
      "step": 4,
      "title": "Konsumsi API",
      "description": "Gunakan Bearer Token untuk mengambil data di aplikasi frontend Anda melalui REST atau GraphQL.",
      "icon": "Code"
    }
  ],
  "sacms-faq": [
    {
      "question": "Apa kelebihan SaCMS dibandingkan Strapi?",
      "answer": "Strapi mengharuskan Anda melakukan self-host instance terpisah untuk setiap klien (tidak ada fitur multi-tenant asli). SaCMS adalah SaaS murni yang memungkinkan Anda mengelola ribuan klien dari satu codebase dan dashboard.",
      "order": 1
    },
    {
      "question": "Apakah SaCMS mendukung pembayaran lokal?",
      "answer": "Ya, SaCMS sudah terintegrasi secara mendalam dengan Midtrans untuk menangani tagihan berlangganan otomatis ke klien Anda melalui GoPay, Virtual Account, hingga Kartu Kredit.",
      "order": 2
    },
    {
      "question": "Bagaimana cara kerja API-nya?",
      "answer": "SaCMS menyediakan REST API dengan filter ala Strapi dan GraphQL API. Seluruh request dilindungi dengan API Token terenkripsi SHA-256 dan dilimitasi oleh Upstash Redis di level Edge.",
      "order": 3
    },
    {
      "question": "Apakah data klien saya aman?",
      "answer": "Sangat aman. SaCMS menerapkan isolasi data multi-tenant secara absolut di level Prisma ORM. Sebuah query tidak akan pernah bisa mengakses data dari Tenant ID yang berbeda.",
      "order": 4
    }
  ],
  "sacms-addons": [
    {
      "icon": "Database",
      "name": "Penyimpanan Ekstra",
      "description": "50GB tambahan penyimpanan Cloudflare R2 untuk aset digital berat.",
      "price": 29000,
      "unit": "bulan"
    },
    {
      "icon": "Zap",
      "name": "Boost API Request",
      "description": "Tambahan kuota 500.000 API request untuk traffic website tinggi.",
      "price": 39000,
      "unit": "bulan"
    }
  ],
  "sacms-workspace-pricing": [
    {
      "name": "SaCMS Free Forever",
      "plan_slug": "free",
      "price": 0,
      "yearly_price": 0,
      "period": "selamanya",
      "description": "Kapasitas dasar gratis untuk belajar, eksplorasi, dan pengembangan sandbox.",
      "max_content_types": 999999,
      "max_content_entries": 500,
      "max_team_members": 1,
      "max_storage": 100,
      "max_locales": 1,
      "max_api_calls": 1000,
      "features": [
        "Unlimited Content Schemas & Tipe Data",
        "500 Entri Konten Dinamis",
        "1 Anggota Tim",
        "100 MB Cloudflare R2 Storage",
        "1.000 API Calls / bulan",
        "50 Bonus AI Credits Awal (Top-Up jika habis)",
        "Live Sandbox Preview (AI Website Builder)",
        "Community Support"
      ]
    },
    {
      "name": "SaCMS Cloud Pro",
      "plan_slug": "pro",
      "price": 249000,
      "yearly_price": 1490000,
      "period": "bulan",
      "is_popular": true,
      "description": "Paket lengkap all-inclusive untuk bisnis, media, dan startup modern (Tanpa Biaya Tersembunyi).",
      "max_content_types": 999999,
      "max_content_entries": 10000,
      "max_team_members": 10,
      "max_storage": 5120,
      "max_locales": 5,
      "max_api_calls": 100000,
      "features": [
        "10.000 Entri Konten & Unlimited Schemas",
        "10 Anggota Tim & Kolaborasi Multi-Role",
        "5 GB Cloud Storage Media Assets",
        "100.000 API Requests / bulan",
        "500 AI Credits Awal (Top-Up untuk build lanjutan)",
        "🌐 Cloud Edge Global Hosting SUDAH TERMASUK (Rp 0 Tambahan)",
        "🏷️ GRATIS 1 Domain Kustom (.com / .id) Selama 1 Tahun",
        "Sertifikat SSL HTTPS Otomatis & Global Anycast CDN",
        "Prioritas Support & 99.9% SLA"
      ]
    },
    {
      "name": "Cloud VPS Standard",
      "plan_slug": "vps-4",
      "price": 450000,
      "yearly_price": 4500000,
      "period": "bulan",
      "description": "Virtual Private Server terisolasi dengan dedicated storage SSD berkecepatan tinggi.",
      "max_content_types": 999999,
      "max_content_entries": 50000,
      "max_team_members": 25,
      "max_storage": 50000,
      "max_locales": 10,
      "max_api_calls": 500000,
      "features": [
        "4 vCPU Cores & 8 GB RAM",
        "50 GB NVMe / SSD Storage",
        "Dedicated PostgreSQL Instance",
        "Unmetered Bandwidth (Port 1 Gbps)",
        "Full Root / SSH Access & Dedicated IPv4",
        "Automated Daily Snapshot & Backup"
      ]
    },
    {
      "name": "Cloud VDS Dedicated CPU",
      "plan_slug": "vds-s",
      "price": 1250000,
      "yearly_price": 12500000,
      "period": "bulan",
      "description": "100% Dedicated CPU Cores untuk kebutuhan enterprise dan instansi pemerintah.",
      "max_content_types": 999999,
      "max_content_entries": 500000,
      "max_team_members": 100,
      "max_storage": 200000,
      "max_locales": 50,
      "max_api_calls": 5000000,
      "features": [
        "4 Dedicated CPU Cores (100% Dedicated)",
        "24 GB RAM & 200 GB NVMe Storage",
        "Isolated Dedicated PostgreSQL 17 Appliance",
        "Gov & Enterprise Compliance Ready",
        "Custom SSL & Anycast DNS Shield",
        "24/7 Dedicated Support & SLA 99.99%"
      ]
    }
  ],
  "sacms-testimonials": [
    {
      "name": "Zonggonau Cristoper",
      "role": "Solo Developer",
      "company": "Indie Hacker",
      "content": "Dulu saya harus setup droplet baru tiap kali ada klien web company profile. Sekarang semua masuk ke SaCMS, hemat biaya server 80%!",
      "avatar_url": "https://api.dicebear.com/7.x/avataaars/svg?seed=Cristoper",
      "rating": 5
    },
    {
      "name": "Januar Fonda",
      "role": "Tech Lead",
      "company": "Digital Agency",
      "content": "Fitur auto-billing via Midtrans sangat membantu kami menagih biaya langganan bulanan ke klien tanpa harus kirim invoice manual lagi.",
      "avatar_url": "https://api.dicebear.com/7.x/avataaars/svg?seed=Januar",
      "rating": 5
    },
    {
      "name": "Budi Santoso",
      "role": "CTO",
      "company": "Tech Media Group",
      "content": "Arsitektur multi-tenant dengan isolasi data PostgreSQL 17 memberi rasa aman bagi klien enterprise kami.",
      "avatar_url": "https://api.dicebear.com/7.x/avataaars/svg?seed=Budi",
      "rating": 5
    }
  ],
  "sacms-owners": [
    {
      "name": "Cristoper Zonggonau",
      "role": "Platform Architect & Founder",
      "bio": "Spesialis arsitektur sistem multi-tenant, cloud edge computing, dan pengembang inti platform SaCMS.",
      "avatar_url": "https://api.dicebear.com/7.x/avataaars/svg?seed=Cristoper",
      "linkedin": "https://linkedin.com"
    },
    {
      "name": "Januar Fonda",
      "role": "Head of Engineering",
      "bio": "Fokus pada integrasi GraphQL performa tinggi, Next.js 16 App Router, dan sistem automasi AI coding.",
      "avatar_url": "https://api.dicebear.com/7.x/avataaars/svg?seed=Januar",
      "linkedin": "https://linkedin.com"
    },
    {
      "name": "Tim SaCMS",
      "role": "Product & Infrastructure",
      "bio": "Membangun dedicated PostgreSQL 17 appliance dan sistem billing otomatis untuk pasar enterprise.",
      "avatar_url": "https://api.dicebear.com/7.x/avataaars/svg?seed=Team",
      "linkedin": "https://linkedin.com"
    }
  ],
  "sacms-about": {
    "title": "Tentang SaCMS — Smart Content Management System",
    "description": "<p>SaCMS (Smart Content Management System) lahir dengan moto <strong>'Build smarter. Manage easier. Scale faster.'</strong> — mendemokratisasi teknologi Headless CMS dan Dedicated Appliance kelas enterprise untuk seluruh developer, software house, dan instansi.</p><p class=\"mt-3\">Dengan arsitektur Hybrid Multi-Tenancy dan Dedicated PostgreSQL 17 Appliance, SaCMS memberikan performa maksimal, privasi data absolut, dan integrasi modern tanpa kompromi.</p>",
    "mission": "Membantu para developer dan bisnis membangun produk digital lebih cerdas (Build smarter), mengelola konten lebih mudah (Manage easier), dan menskalakan infrastruktur lebih cepat (Scale faster).",
    "founded": "2026"
  },
  "sacms-whatsapp": {
    "phone": "6282199220551",
    "message": "Halo! Saya tertarik dengan integrasi SaCMS untuk proyek web saya.",
    "label": "Hubungi Kami",
    "is_active": true
  },
  "sacms-sectors": [
    {
      "icon": "Building2",
      "label": "Digital Agency & Software House",
      "desc": "Kelola puluhan website klien dari satu dasbor white-label tanpa pusing biaya server terpisah."
    },
    {
      "icon": "Landmark",
      "label": "Pemerintah & BUMN",
      "desc": "Keamanan database terisolasi (Gov VDS), kedaulatan data lokal, dan kepatuhan audit sistem."
    },
    {
      "icon": "ShoppingBag",
      "label": "E-Commerce & Startup",
      "desc": "Manajemen inventaris dinamis, API transaksi kilat, dan integrasi headless storefront modern."
    },
    {
      "icon": "Code2",
      "label": "Solo Builders & Developers",
      "desc": "Luncurkan MVP dalam hitungan jam dengan paket ekonomis, visual schema builder, dan AI website assistant."
    }
  ],
  "sacms-local-pride": {
    "badge": "Smart Content Management System",
    "title": "Build smarter. Manage easier. Scale faster.",
    "description": "Kami memahami betapa frustrasinya mengelola banyak instance CMS terpisah dan menagih klien secara manual. SaCMS hadir untuk merangkum semua infrastruktur tersebut menjadi satu panel kontrol terpadu yang elegan."
  },
  "sacms-cta": {
    "title": "Build smarter. Manage easier. Scale faster.",
    "description": "Mulai gunakan SaCMS (Smart Content Management System) hari ini. Nikmati arsitektur multi-tenant murni, performa Next.js 16 secepat kilat, dan tagihan Midtrans otomatis.",
    "button_primary_text": "Coba Gratis Sekarang",
    "button_secondary_text": "Baca Dokumentasi API"
  },
  "sacms-blogs": [
    {
      "slug": "arsitektur-multi-tenancy-hybrid-sacms",
      "title": "Mengenal Arsitektur Hybrid Multi-Tenancy di SaCMS: Dari Shared Pool Hingga Dedicated PostgreSQL Appliance",
      "excerpt": "Pelajari bagaimana SaCMS menggabungkan fleksibilitas shared database pool untuk paket starter dan isolasi fisik dedicated database PostgreSQL 17 untuk kebutuhan enterprise.",
      "category": "Arsitektur",
      "date": "30 Agustus 2026",
      "author": "Tim SaCMS",
      "author_avatar": "https://api.dicebear.com/7.x/avataaars/svg?seed=ArchLead",
      "cover_image": "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=1200&q=80",
      "read_time": "5 menit baca",
      "is_featured": true,
      "content": `
        <h2>Mengapa Multi-Tenancy Tradisional Kurang Fleksibel?</h2>
        <p>Dalam pengembangan SaaS modern, memilih strategi multi-tenancy seringkali menjadi perdebatan antara <em>efisiensi biaya</em> (shared database) dan <em>keamanan data absolut</em> (isolated database). Sebagian besar CMS hanya mendukung salah satu dari dua pendekatan tersebut.</p>
        
        <h2>Pendekatan Hybrid SaCMS</h2>
        <p>SaCMS memperkenalkan model <strong>Hybrid Multi-Tenancy</strong> yang inovatif:</p>
        <ul>
          <li><strong>Shared Workspace Pool:</strong> Cocok untuk paket gratis dan starter, di mana data setiap tenant dipisahkan secara logis via <code>tenantId</code> dengan perlindungan query injection-safe.</li>
          <li><strong>Dedicated Appliance Routing:</strong> Untuk tier enterprise atau instansi pemerintah, SaCMS secara otomatis mengarahkan koneksi ke instance PostgreSQL 17 mandiri dengan pooler terpisah tanpa mengubah API contract.</li>
        </ul>

        <h2>Otomasi Migrasi Skema Tanpa Downtime</h2>
        <p>Setiap kali admin mengubah tipe konten di Visual Builder, SaCMS menjalankan sinkronisasi skema runtime ke seluruh database tenant yang terhubung secara paralel, menjamin ketersediaan 99.99%.</p>
      `
    },
    {
      "slug": "panduan-custom-domain-dns-ala-vercel",
      "title": "Panduan Lengkap Setup Custom Domain DNS ala Vercel di SaCMS",
      "excerpt": "Hubungkan domain instansi atau bisnis Anda dengan verifikasi DNS otomatis, A Record Apex, CNAME Subdomain, dan SSL Let's Encrypt gratis.",
      "category": "Tutorial",
      "date": "28 Agustus 2026",
      "author": "Cristoper Zonggonau",
      "author_avatar": "https://api.dicebear.com/7.x/avataaars/svg?seed=Cristoper",
      "cover_image": "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1200&q=80",
      "read_time": "4 menit baca",
      "is_featured": false,
      "content": `
        <h2>Menghubungkan Domain Kustom dalam Hitungan Detik</h2>
        <p>SaCMS mempermudah pengelolaan domain khusus untuk setiap workspace tanpa perlu mengatur Nginx atau sertifikat SSL manual.</p>
        
        <h3>Langkah 1: Tentukan Domain Anda</h3>
        <p>Masuk ke menu <strong>Domains</strong> pada dashboard workspace Anda, lalu ketik nama domain yang ingin Anda gunakan (contoh: <code>portal.perusahaan.com</code>).</p>
        
        <h3>Langkah 2: Konfigurasi DNS di Registrar</h3>
        <ul>
          <li><strong>Root / Apex Domain:</strong> Tambahkan <code>A Record</code> mengarah ke IP Gateway SaCMS: <code>161.97.100.1</code>.</li>
          <li><strong>Subdomain:</strong> Tambahkan <code>CNAME Record</code> mengarah ke <code>cname.sacms.cloud</code>.</li>
        </ul>
        
        <h3>Langkah 3: Verifikasi Otomatis & SSL</h3>
        <p>Sistem edge proxy Caddy di SaCMS akan secara otomatis memverifikasi DNS challenge dan menerbitkan sertifikat HTTPS Let's Encrypt secara instan.</p>
      `
    },
    {
      "slug": "integrasi-nextjs-16-graphql-mcp-ai",
      "title": "Membangun Frontend Next.js 16 Super Cepat dengan Dynamic GraphQL & MCP AI Bridge",
      "excerpt": "Cara memanfaatkan dynamic GraphQL schema SaCMS dan Model Context Protocol (MCP) untuk mempercepat integrasi frontend dan automasi AI coding.",
      "category": "Tutorial",
      "date": "25 Agustus 2026",
      "author": "Januar Fonda",
      "author_avatar": "https://api.dicebear.com/7.x/avataaars/svg?seed=Januar",
      "cover_image": "https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=1200&q=80",
      "read_time": "6 menit baca",
      "is_featured": false,
      "content": `
        <h2>Dynamic GraphQL: Satu Skema untuk Seluruh Tipe Konten</h2>
        <p>SaCMS tidak memerlukan restart server setiap kali skema berubah. Engine GraphQL dinamis kami langsung merakit schema AST secara on-the-fly dari definisi model konten.</p>
        
        <h2>Model Context Protocol (MCP) untuk AI Assistant</h2>
        <p>Dengan endpoint MCP bawaan, Anda dapat menghubungkan Claude, Antigravity, atau AI IDE lainnya untuk membaca skema konten, membuat draft artikel otomatis, dan mengekspor tipe data TypeScript secara instan.</p>
      `
    },
    {
      "slug": "optimasi-performa-edge-cache-upstash-redis",
      "title": "Strategi Caching 0-Latency Menggunakan Upstash Redis & Next.js App Router",
      "excerpt": "Bagaimana SaCMS memanfaatkan edge caching dan rate limiting terdistribusi untuk melayani jutaan request API per menit.",
      "category": "Arsitektur",
      "date": "20 Agustus 2026",
      "author": "Tim SaCMS",
      "author_avatar": "https://api.dicebear.com/7.x/avataaars/svg?seed=Team",
      "cover_image": "https://images.unsplash.com/photo-1544197150-b99a580bb7a8?auto=format&fit=crop&w=1200&q=80",
      "read_time": "3 menit baca",
      "is_featured": false,
      "content": `
        <h2>Mengapa Latensi Penting untuk Headless CMS?</h2>
        <p>Frontend headless sangat bergantung pada kecepatan respons API CMS. SaCMS menerapkan strategi multi-tier caching menggunakan Upstash Redis di edge layer.</p>
        <p>Dengan *stale-while-revalidate* dan tag-based cache invalidation, setiap perubahan konten langsung terdistribusi ke seluruh node global dalam waktu kurang dari 50 milidetik.</p>
      `
    },
    {
      "slug": "update-v2-white-label-billing-midtrans",
      "title": "Rilis SaCMS v2.0: Dukungan White-Label Lengkap & Integrasi Tagihan Midtrans Otomatis",
      "excerpt": "Kini digital agency dapat menyesuaikan logo, favicon, warna tema, hingga penagihan otomatis ke klien dengan QRIS dan Virtual Account.",
      "category": "Update",
      "date": "15 Agustus 2026",
      "author": "Tim SaCMS",
      "author_avatar": "https://api.dicebear.com/7.x/avataaars/svg?seed=ProductLead",
      "cover_image": "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1200&q=80",
      "read_time": "4 menit baca",
      "is_featured": false,
      "content": `
        <h2>Transformasi CMS Menjadi Produk Milik Agensi Anda</h2>
        <p>Fitur White-Label memungkinkan agensi menghadirkan portal CMS dengan merek mereka sendiri kepada klien, lengkap dengan sub-domain khusus dan kustomisasi palet warna.</p>
        <p>Integrasi Midtrans Snap memudahkan monetisasi langganan konten secara otomatis tanpa repot rekonsiliasi manual.</p>
      `
    }
  ],
  "sacms-footer": {
    "brand_name": "SaCMS",
    "description": "SaCMS — Smart Content Management System. Build smarter. Manage easier. Scale faster. Platform SaaS Headless CMS terdepan untuk transformasi digital.",
    "copyright": "SaCMS. Hak cipta dilindungi."
  }
}

