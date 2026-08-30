import { db } from "../src/lib/database"

async function main() {
  console.log("🚀 Syncing 3x3 White-Label Pricing (No Contabo / Vercel Branding) to CMS Database...")

  const ct = await db.contentType.findFirst({
    where: { slug: "sacms-workspace-pricing" }
  })

  if (!ct) {
    console.error("❌ ContentType 'sacms-workspace-pricing' not found in database.")
    return
  }

  // Find global or main tenant
  const globalTenant = await db.tenant.findFirst({
    where: { slug: "sacms-global" }
  }) || await db.tenant.findFirst()

  if (!globalTenant) {
    console.error("❌ No tenant found.")
    return
  }

  // Delete old workspace pricing entries
  const deleted = await db.contentEntry.deleteMany({
    where: { contentTypeId: ct.id }
  })
  console.log(`🧹 Deleted ${deleted.count} old workspace pricing entries.`)

  // 3x3 Matrix Calculation (White-Label - 100% Brand-Free):
  // 1. Cloud Ekonomis (Shared DB) -> Margin 50%
  //    - Free: Rp 0
  //    - Pro: Rp 249.000 / bln
  //    - Business: Rp 490.000 / bln
  // 2. Cloud VPS Standar (Dedicated Cloud VPS) -> 500% Margin Markup
  //    - VPS 8GB (VPS Plus 4): Rp 700.000 / bln (Tahunan: Rp 7.000.000)
  //    - VPS 16GB (VPS Plus 6): Rp 1.240.000 / bln (Tahunan: Rp 12.400.000)
  //    - VPS 24GB (VPS Plus 8): Rp 1.990.000 / bln (Tahunan: Rp 19.900.000)
  // 3. Gov & Enterprise VDS (Dedicated Physical Cores) -> 500% Margin Markup
  //    - VDS 3 Cores (VDS S): Rp 3.990.000 / bln (Tahunan: Rp 39.900.000)
  //    - VDS 4 Cores (VDS M): Rp 5.290.000 / bln (Tahunan: Rp 52.900.000)
  //    - VDS 6 Cores (VDS L): Rp 7.450.000 / bln (Tahunan: Rp 74.500.000)

  const unifiedPlans = [
    // ─── 1. CLOUD EKONOMIS (SHARED SAAS — 50% MARGIN) ───
    {
      plan_slug: "free",
      name: "SaCMS Free Forever",
      description: "Kapasitas dasar gratis untuk belajar, eksplorasi, dan pengembangan sandbox.",
      price: 0,
      yearly_price: 0,
      is_popular: false,
      cta_text: "Paket Saat Ini",
      features: [
        "Unlimited Content Schemas & Tipe Data",
        "500 Entri Konten Dinamis",
        "1 Anggota Tim",
        "100 MB Cloudflare R2 Storage",
        "1.000 API Calls / bulan",
        "50 AI Generation Credits",
        "Live Sandbox Preview (AI Website Builder)",
        "Community Support"
      ],
      max_content_types: 999999,
      max_content_entries: 500,
      max_team_members: 1,
      max_api_calls: 1000,
      max_storage: 100,
      max_locales: 1,
      audit_log_retention: 0,
      support_level: "Community"
    },
    {
      plan_slug: "pro",
      name: "SaCMS Cloud Pro",
      description: "Paket lengkap all-inclusive untuk bisnis, media, dan startup modern (Tanpa Biaya Tersembunyi).",
      price: 249000,
      yearly_price: 1490000,
      is_popular: true,
      cta_text: "Pilih Cloud Pro",
      features: [
        "10.000 Entri Konten & Unlimited Schemas",
        "10 Anggota Tim & Kolaborasi Multi-Role",
        "5 GB Cloud Storage Media Assets",
        "100.000 API Requests / bulan",
        "500 AI Website Builder Credits / bulan",
        "🌐 Cloud Edge Global Hosting SUDAH TERMASUK (Rp 0 Tambahan)",
        "🏷️ GRATIS 1 Domain Kustom (.com / .id) Selama 1 Tahun",
        "Sertifikat SSL HTTPS Otomatis & Global Anycast CDN",
        "Prioritas Support & 99.9% SLA"
      ],
      max_content_types: 999999,
      max_content_entries: 10000,
      max_team_members: 10,
      max_api_calls: 100000,
      max_storage: 5120,
      max_locales: 5,
      audit_log_retention: 30,
      support_level: "Prioritas & SLA 99.9%"
    },
    {
      plan_slug: "business",
      name: "SaCMS Cloud Business",
      description: "Platform CMS andalan untuk korporasi, portal media nasional, dan traffic tinggi.",
      price: 490000,
      yearly_price: 2900000,
      is_popular: false,
      cta_text: "Pilih Cloud Business",
      features: [
        "50.000 Entri Konten & Unlimited Schemas",
        "25 Anggota Tim (Multi-Level Approvals & Workflow)",
        "10 GB Cloud Storage Media Assets",
        "1.000.000 API Requests / bulan",
        "1.500 AI Credits Awal (Top-Up untuk build lanjutan)",
        "🌐 Cloud Edge Global Hosting SUDAH TERMASUK (Rp 0 Ekstra)",
        "🏷️ GRATIS 1 Domain Premium (.go.id / .ac.id / .co.id / .com)",
        "Custom SMTP Mail Transporter & Audit Log Ekstensi",
        "24/7 Prioritas Support & SLA 99.9%"
      ],
      max_content_types: 999999,
      max_content_entries: 50000,
      max_team_members: 25,
      max_api_calls: 1000000,
      max_storage: 10240,
      max_locales: 10,
      audit_log_retention: 90,
      support_level: "24/7 Prioritas Support & SLA 99.9%"
    },

    // ─── 2. CLOUD VPS STANDAR (DEDICATED CLOUD VPS — 500% MARGIN) ───
    {
      plan_slug: "vps-s",
      name: "SaCMS VPS Cloud 8GB",
      description: "Dedicated Cloud VPS ekonomis untuk database mandiri dan website bisnis/UMKM.",
      price: 700000,
      yearly_price: 7000000,
      is_popular: false,
      cta_text: "Pilih VPS 8GB",
      features: [
        "🚀 Dedicated Cloud VPS (4 vCPU, 8 GB RAM, 150 GB NVMe)",
        "🗄️ Dedicated PostgreSQL 17 Database Server Mandiri",
        "📦 Dedicated S3-Compatible Object Storage (150 GB NVMe)",
        "🌐 Fullstack Next.js Frontend Hosting di VPS (Rp 0 Ekstra)",
        "100.000 Entri Konten & 20 Anggota Tim",
        "1.000 AI Credits / bulan",
        "Enterprise Cloud Firewall & Auto Backup",
        "Prioritas 24/7 Support & SLA 99.9%"
      ],
      max_content_types: 999999,
      max_content_entries: 100000,
      max_team_members: 20,
      max_api_calls: 5000000,
      max_storage: 153600,
      max_locales: 20,
      audit_log_retention: 180,
      support_level: "Prioritas 24/7 & SLA 99.9%"
    },
    {
      plan_slug: "enterprise-vps",
      name: "SaCMS VPS Cloud 16GB",
      description: "Server Dedicated Cloud 100% terisolasi untuk database, storage, dan frontend website Anda.",
      price: 1240000,
      yearly_price: 12400000,
      is_popular: true,
      cta_text: "Pilih VPS 16GB",
      features: [
        "🚀 Dedicated Cloud VPS (6 vCPU, 16 GB RAM, 300 GB NVMe)",
        "🗄️ Dedicated PostgreSQL 17 Database Server Mandiri",
        "📦 Dedicated S3-Compatible Object Storage (300 GB NVMe)",
        "🌐 Fullstack Next.js Frontend Hosting di VPS (Rp 0 / 32 TB Bandwidth)",
        "500.000 Entri Konten & 50 Anggota Tim",
        "2.000 AI Credits / bulan",
        "Enterprise Cloud Firewall & Auto Backup",
        "24/7 Dedicated Support & SLA 99.99%"
      ],
      max_content_types: 999999,
      max_content_entries: 500000,
      max_team_members: 50,
      max_api_calls: 10000000,
      max_storage: 307200,
      max_locales: 50,
      audit_log_retention: 365,
      support_level: "24/7 Dedicated SLA"
    },
    {
      plan_slug: "vps-l",
      name: "SaCMS VPS Cloud 24GB",
      description: "Kapasitas server VPS maksimum untuk platform media, e-commerce, dan throughput tinggi.",
      price: 1990000,
      yearly_price: 19900000,
      is_popular: false,
      cta_text: "Pilih VPS 24GB",
      features: [
        "🚀 Dedicated Cloud VPS (8 vCPU, 24 GB RAM, 450 GB NVMe)",
        "🗄️ Dedicated PostgreSQL 17 Database Server Mandiri",
        "📦 Dedicated S3-Compatible Object Storage (450 GB NVMe)",
        "🌐 Fullstack Next.js Frontend Hosting di VPS (Rp 0 / 1 Gbps Port)",
        "1.500.000 Entri Konten & 100 Anggota Tim",
        "5.000 AI Credits / bulan",
        "Enterprise Cloud Firewall & Auto Backup",
        "24/7 Dedicated Support & SLA 99.99%"
      ],
      max_content_types: 999999,
      max_content_entries: 1500000,
      max_team_members: 100,
      max_api_calls: 25000000,
      max_storage: 460800,
      max_locales: 100,
      audit_log_retention: 365,
      support_level: "24/7 Dedicated SLA"
    },

    // ─── 3. GOV & ENTERPRISE VDS (100% DEDICATED CPU — 500% MARGIN) ───
    {
      plan_slug: "vds-s",
      name: "SaCMS Gov VDS 3 Cores",
      description: "Dedicated Enterprise VDS dengan 3 Dedicated Physical Cores terisolasi penuh untuk Instansi Pemerintah & Fintech.",
      price: 3990000,
      yearly_price: 39900000,
      is_popular: false,
      cta_text: "Pilih VDS 3 Cores",
      features: [
        "🛡️ Dedicated VDS (3 Dedicated Physical CPU Cores 100% Locked, 24 GB RAM, 180 GB NVMe)",
        "100% Dedicated CPU Lock (Zero Noisy Neighbor)",
        "Dedicated PostgreSQL 17 + MinIO S3 (180 GB) + Next.js Frontend Cluster",
        "3.000.000 Entri Konten & 150 Anggota Tim",
        "5.000 AI Credits / bulan",
        "Enterprise Cloud Firewall Hardware Whitelist",
        "Dedicated DevOps Support & SLA 99.99%"
      ],
      max_content_types: 999999,
      max_content_entries: 3000000,
      max_team_members: 150,
      max_api_calls: 50000000,
      max_storage: 184320,
      max_locales: 150,
      audit_log_retention: 730,
      support_level: "Dedicated DevOps & 99.99% SLA"
    },
    {
      plan_slug: "enterprise-vds",
      name: "SaCMS Gov VDS 4 Cores",
      description: "Dedicated Physical CPU Cores terisolasi untuk transaksi kritis instansi pemerintah, BUMN, dan fintech.",
      price: 5290000,
      yearly_price: 52900000,
      is_popular: true,
      cta_text: "Pilih VDS 4 Cores",
      features: [
        "🛡️ Dedicated VDS (4 Dedicated Physical CPU Cores 100% Locked, 32 GB RAM, 240 GB NVMe)",
        "100% Dedicated CPU Lock (Zero Noisy Neighbor)",
        "Dedicated PostgreSQL 17 + MinIO S3 (240 GB) + Next.js Frontend Cluster",
        "10.000.000 Entri Konten & 300 Anggota Tim",
        "10.000 AI Credits / bulan",
        "Lisensi RSA Enterprise Self-Hosted / On-Premise Ready",
        "Dedicated DevOps Engineer & SLA 99.99%"
      ],
      max_content_types: 999999,
      max_content_entries: 10000000,
      max_team_members: 300,
      max_api_calls: 100000000,
      max_storage: 245760,
      max_locales: 300,
      audit_log_retention: 730,
      support_level: "Dedicated DevOps Engineer & 99.99% SLA"
    },
    {
      plan_slug: "vds-l",
      name: "SaCMS Gov VDS 6 Cores",
      description: "Performa dedicated baremetal-grade maksimum dengan 6 Physical Cores & 48 GB RAM untuk sistem nasional terpusat.",
      price: 7450000,
      yearly_price: 74500000,
      is_popular: false,
      cta_text: "Pilih VDS 6 Cores",
      features: [
        "🛡️ Dedicated VDS (6 Dedicated Physical CPU Cores 100% Locked, 48 GB RAM, 360 GB NVMe)",
        "100% Dedicated CPU Lock (Zero Contention / Zero Noisy Neighbor)",
        "Dedicated PostgreSQL 17 + MinIO S3 (360 GB) + Next.js Enterprise Cluster",
        "Unlimited Entri Konten & Unlimited Anggota Tim",
        "25.000 AI Credits / bulan",
        "Lisensi RSA Enterprise Self-Hosted / On-Premise Multi-Node Ready",
        "Dedicated 24/7 SRE & DevOps Team + SLA 99.99%"
      ],
      max_content_types: 999999,
      max_content_entries: 99999999,
      max_team_members: 9999,
      max_api_calls: 500000000,
      max_storage: 368640,
      max_locales: 999,
      audit_log_retention: 1825,
      support_level: "Dedicated 24/7 SRE & DevOps Team"
    }
  ]

  for (const p of unifiedPlans) {
    await db.contentEntry.create({
      data: {
        contentTypeId: ct.id,
        tenantId: globalTenant.id,
        status: "PUBLISHED",
        data: p as any
      }
    })
    console.log(`✅ Seeded white-label workspace plan: "${p.name}" (${p.plan_slug}) - Rp ${p.price.toLocaleString("id-ID")}/bln`)
  }

  // ─── SYNC SACMS-ACCOUNT-PRICING (EKONOMIS) ───
  const accountCt = await db.contentType.findFirst({
    where: { slug: "sacms-account-pricing" }
  })

  if (accountCt) {
    const deletedAcc = await db.contentEntry.deleteMany({
      where: { contentTypeId: accountCt.id }
    })
    console.log(`🧹 Deleted ${deletedAcc.count} old account pricing entries.`)

    const accountPlans = [
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
    ]

    for (const ap of accountPlans) {
      await db.contentEntry.create({
        data: {
          contentTypeId: accountCt.id,
          tenantId: globalTenant.id,
          status: "PUBLISHED",
          data: ap as any
        }
      })
      console.log(`✅ Seeded economical account plan: "${ap.name}" (${ap.plan_slug}) - Rp ${ap.price.toLocaleString("id-ID")}/bln`)
    }
  }

  console.log("🎉 All Workspace & Economical Account Pricing successfully synced to CMS database!")
}

main()
  .catch(console.error)
  .finally(async () => {
    await db.$disconnect()
  })
