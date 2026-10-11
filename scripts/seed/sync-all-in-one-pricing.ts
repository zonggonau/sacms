import { db } from "@/lib/database"

async function main() {
  console.log("🚀 Syncing 3x3 White-Label Pricing (No Vercel Branding) to CMS Database...")

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

  // Cloud Ekonomis (Shared DB) -> Margin 50%
  //    - Free: Rp 0
  //    - Pro: Rp 249.000 / bln
  //    - Business: Rp 490.000 / bln

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
