export const DEFAULT_LANDING_PAGE_DATA: any = {
  "sacms-hero": {
    "headline": "Hentikan Kerumitan Mengelola Puluhan CMS Terpisah.",
    "subheadline": "SaCMS adalah Headless CMS Multi-Tenant sejati. Satu codebase untuk mengelola semua klien Anda dengan isolasi data absolut, integrasi billing Midtrans otomatis, dan API secepat kilat.",
    "cta_primary": "Coba Gratis Sekarang",
    "cta_secondary": "Lihat Dokumentasi",
    "badge_text": "🚀 SaaS Headless Engine Generasi Baru",
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
    }
  ],
  "sacms-owners": [
    {
      "name": "Tim SaCMS",
      "role": "Platform Engineers",
      "bio": "Dibangun oleh developer untuk developer, memecahkan masalah fragmentasi CMS.",
      "avatar_url": "https://api.dicebear.com/7.x/avataaars/svg?seed=Team",
      "linkedin": ""
    }
  ],
  "sacms-about": {
    "title": "Tentang SaCMS",
    "description": "Platform Headless CMS generasi baru yang menghilangkan kompleksitas pengelolaan infrastruktur untuk agensi dan freelance developer.",
    "mission": "Mempercepat pengiriman proyek digital dengan infrastruktur CMS yang terpusat, aman, dan mudah dimonetisasi.",
    "founded": "2026"
  },
  "sacms-whatsapp": {
    "phone": "6282199220551",
    "message": "Halo! Saya ingin berdiskusi mengenai integrasi SaCMS untuk agensi saya.",
    "label": "Hubungi Kami",
    "is_active": true
  },
  "sacms-sectors": [
    {
      "icon": "Building",
      "label": "Digital Agency",
      "desc": "Kelola puluhan klien web"
    },
    {
      "icon": "Code",
      "label": "Solo Developer",
      "desc": "Kurangi biaya server"
    },
    {
      "icon": "ShoppingBag",
      "label": "E-Commerce",
      "desc": "Katalog headless"
    },
    {
      "icon": "Briefcase",
      "label": "SaaS Builders",
      "desc": "Backend data terpusat"
    }
  ],
  "sacms-local-pride": {
    "badge": "Solusi B2B Terbaik",
    "title": "Dibangun Untuk Menjawab Masalah Nyata Developer.",
    "description": "Kami memahami betapa frustrasinya mengelola banyak instance CMS terpisah dan menagih klien. SaCMS hadir untuk merangkum semua infrastruktur tersebut menjadi satu panel kontrol elegan."
  },
  "sacms-cta": {
    "title": "Siap Berhenti Melakukan Self-Host CMS?",
    "description": "Pindahkan proyek klien Anda ke SaCMS. Skalabilitas tanpa batas, tanpa pusing.",
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
    "description": "The Ultimate Multi-Tenant Headless CMS for Modern Developers and Agencies.",
    "copyright": "SaCMS. Hak cipta dilindungi."
  }
}

