/**
 * Seeds the 4 admin-curated pricing tables (AccountPlan, WorkspacePlan,
 * AiCreditPack, Addon — see src/lib/pricing.ts) with a real, coherent
 * starter catalog, so /admin/pricing has something to click on and edit
 * instead of showing empty categories on a fresh environment.
 *
 * Safe to run anytime, including on production: every row is only
 * CREATED if its slug doesn't already exist — an admin's later edits (or
 * a previous run of this same script) are never touched or overwritten.
 * Run with: `bun run seed:pricing`
 */
import { db } from "@/lib/database"

async function seedAccountPlans() {
  const plans = [
    {
      slug: "free",
      name: "Akun Gratis",
      description: "Mulai tanpa biaya untuk eksplorasi dan pengembangan sandbox.",
      price: 0,
      yearlyPrice: 0,
      maxWorkspaces: 1,
      features: ["1 Workspace Mandiri", "Akses Penuh CMS Editor & API", "Dukungan Komunitas"],
      isPopular: false,
      ctaText: "Mulai Gratis",
      ctaHref: "/register",
      order: 0,
    },
    {
      slug: "starter",
      name: "Akun Standar",
      description: "Sangat ekonomis untuk solo developer, freelance & UMKM.",
      price: 49000,
      yearlyPrice: 390000,
      maxWorkspaces: 3,
      features: ["Hingga 3 Workspace Aktif", "Multi-Project Management UMKM", "Akses REST & GraphQL API", "Dukungan Email Prioritas"],
      isPopular: false,
      ctaText: "Pilih Standar",
      ctaHref: "/register",
      order: 1,
    },
    {
      slug: "pro",
      name: "Akun Profesional",
      description: "Paling diminati untuk agensi digital, startup & tim produk.",
      price: 129000,
      yearlyPrice: 990000,
      maxWorkspaces: 5,
      features: ["Hingga 5 Workspace Aktif", "Kolaborasi Multi-Tim & RBAC", "Custom Domain Routing", "Audit Log & Security Center", "Dukungan Prioritas 24/7"],
      isPopular: true,
      ctaText: "Pilih Pro",
      ctaHref: "/register",
      order: 2,
    },
    {
      slug: "enterprise",
      name: "Akun Bisnis & Agensi",
      description: "Kapasitas besar untuk software house & agensi berskala.",
      price: 299000,
      yearlyPrice: 2490000,
      maxWorkspaces: 10,
      features: ["Hingga 10 Workspace Aktif", "Multi-Tenant Enterprise Hub", "Dedicated White-Label Branding", "Custom Role & Fine-Grained Permissions", "Dedicated Account Manager & SLA 99.9%"],
      isPopular: false,
      ctaText: "Pilih Bisnis",
      ctaHref: "/register",
      order: 3,
    },
  ]

  for (const p of plans) {
    const existing = await db.accountPlan.findUnique({ where: { slug: p.slug } })
    if (existing) {
      console.log(`  [account-plans] skip "${p.slug}" — already exists`)
      continue
    }
    await db.accountPlan.create({ data: p })
    console.log(`  [account-plans] created "${p.slug}"`)
  }
}

async function seedWorkspacePlans() {
  const plans = [
    {
      slug: "free",
      name: "SaCMS Free Forever",
      description: "Kapasitas dasar gratis untuk belajar, eksplorasi, dan pengembangan sandbox.",
      price: 0,
      yearlyPrice: 0,
      maxContentTypes: 999999,
      maxContentEntries: 500,
      maxTeamMembers: 1,
      maxStorageMb: 100,
      maxLocales: 1,
      maxApiCalls: 1000,
      fairUseBandwidthGb: 2,
      features: [
        "Unlimited Content Schemas & Tipe Data",
        "500 Entri Konten Dinamis",
        "1 Anggota Tim",
        "100 MB Cloud Storage",
        "1.000 API Calls / bulan",
        "REST & GraphQL API",
        "Community Support",
      ],
      order: 0,
    },
    {
      slug: "starter",
      name: "SaCMS Cloud Starter",
      description: "Jembatan untuk freelancer & UMKM yang sudah kelebihan kuota Free, belum butuh kolaborasi tim penuh.",
      price: 99000,
      yearlyPrice: 592000,
      maxContentTypes: 999999,
      maxContentEntries: 2000,
      maxTeamMembers: 3,
      maxStorageMb: 1024,
      maxLocales: 2,
      maxApiCalls: 10000,
      fairUseBandwidthGb: 10,
      features: [
        "2.000 Entri Konten & Unlimited Schemas",
        "3 Anggota Tim",
        "1 GB Cloud Storage",
        "10.000 API Calls / bulan",
        "2 Bahasa (Locale) Konten",
        "REST & GraphQL API",
        "Email Support",
      ],
      order: 1,
    },
    {
      slug: "pro",
      name: "SaCMS Cloud Pro",
      description: "Paket lengkap all-inclusive untuk bisnis, media, dan startup modern (Tanpa Biaya Tersembunyi).",
      price: 249000,
      yearlyPrice: 1490000,
      maxContentTypes: 999999,
      maxContentEntries: 10000,
      maxTeamMembers: 10,
      maxStorageMb: 5120,
      maxLocales: 5,
      maxApiCalls: 100000,
      fairUseBandwidthGb: 50,
      features: [
        "10.000 Entri Konten & Unlimited Schemas",
        "10 Anggota Tim & Kolaborasi Multi-Role (RBAC)",
        "5 GB Cloud Storage Media Assets",
        "100.000 API Requests / bulan",
        "5 Bahasa (Locale) Konten",
        "Hubungkan Domain Kustom Sendiri + SSL HTTPS Otomatis",
        "Webhook & Integrasi Eksternal",
        "Prioritas Support",
      ],
      order: 2,
    },
    {
      slug: "business",
      name: "SaCMS Cloud Business",
      description: "Platform CMS andalan untuk korporasi, portal media nasional, dan traffic tinggi.",
      price: 490000,
      yearlyPrice: 2900000,
      maxContentTypes: 999999,
      maxContentEntries: 50000,
      maxTeamMembers: 25,
      maxStorageMb: 10240,
      maxLocales: 10,
      maxApiCalls: 1000000,
      fairUseBandwidthGb: 250,
      features: [
        "50.000 Entri Konten & Unlimited Schemas",
        "25 Anggota Tim & Sequential Review Workflow",
        "10 GB Cloud Storage Media Assets",
        "1.000.000 API Requests / bulan",
        "10 Bahasa (Locale) Konten",
        "Hubungkan Domain Kustom Sendiri + SSL HTTPS Otomatis",
        "Custom SMTP Mail Transporter Sendiri",
        "Audit Log Aktivitas Lengkap",
        "Prioritas Support",
      ],
      order: 3,
    },
  ]

  for (const p of plans) {
    const existing = await db.workspacePlan.findUnique({ where: { slug: p.slug } })
    if (existing) {
      console.log(`  [workspace-plans] skip "${p.slug}" — already exists`)
      continue
    }
    await db.workspacePlan.create({ data: p })
    console.log(`  [workspace-plans] created "${p.slug}"`)
  }
}

async function seedAiCreditPacks() {
  const packs = [
    {
      slug: "ai_pack_starter",
      name: "Starter Credits",
      description: "Top-up 300 AI credits untuk build frontend Next.js.",
      credits: 300,
      priceUsd: 9,
      price: 149000,
      badge: null,
      features: ["300 AI Credits", "Sekali Beli (Never Expire)", "Full Next.js Frontend Gen", "Digunakan di Semua Workspace"],
      order: 0,
    },
    {
      slug: "ai_pack_pro",
      name: "Pro Credits",
      description: "Top-up 1.500 AI credits dengan antrean prioritas.",
      credits: 1500,
      priceUsd: 29,
      price: 449000,
      badge: "Most Popular",
      features: ["1.500 AI Credits", "Sekali Beli (Never Expire)", "Iterasi Desain AI Cepat", "Deploy 1-Klik ke SaCMS Cloud Hosting", "Digunakan di Semua Workspace"],
      order: 1,
    },
    {
      slug: "ai_pack_business",
      name: "Business Credits",
      description: "Top-up 5.000 AI credits untuk tim produksi.",
      credits: 5000,
      priceUsd: 79,
      price: 1199000,
      badge: null,
      features: ["5.000 AI Credits", "Sekali Beli (Never Expire)", "Kapasitas Bebas Hambatan", "Export Schema & Kode Lengkap", "Digunakan di Semua Workspace"],
      order: 2,
    },
    {
      slug: "ai_pack_agency",
      name: "Agency Credits",
      description: "Top-up 15.000 AI credits untuk agensi dengan volume tinggi.",
      credits: 15000,
      priceUsd: 149,
      price: 2299000,
      badge: "Best Value",
      features: ["15.000 AI Credits", "Sekali Beli (Never Expire)", "Kecepatan AI Maksimal", "Dukungan Model Lanjutan", "Digunakan di Semua Workspace"],
      order: 3,
    },
  ]

  for (const p of packs) {
    const existing = await db.aiCreditPack.findUnique({ where: { slug: p.slug } })
    if (existing) {
      console.log(`  [ai-credit-packs] skip "${p.slug}" — already exists`)
      continue
    }
    await db.aiCreditPack.create({ data: p })
    console.log(`  [ai-credit-packs] created "${p.slug}"`)
  }
}

async function seedAddons() {
  const addons: any[] = [
    {
      slug: "ai_writer",
      name: "AI Writer",
      description: "Generate konten secara otomatis dengan AI.",
      icon: "Sparkles",
      price: null,
      priceLabel: "Termasuk di Pro",
      featureKey: "ai",
      isTopup: false,
      order: 2,
    },
    {
      slug: "adv_audit",
      name: "Advanced Audit",
      description: "Lacak setiap aktivitas di workspace Anda.",
      icon: "ShieldCheck",
      price: null,
      priceLabel: "Khusus Enterprise",
      featureKey: "audit",
      isTopup: false,
      order: 3,
    },
    {
      slug: "storage_5gb_1y",
      name: "Storage +5 GB / Tahun",
      description: "+5 GB kapasitas storage workspace, berlaku 1 tahun sejak aktif.",
      icon: "HardDrive",
      price: 199000,
      yearlyPrice: 199000,
      unit: "once",
      checkoutAlias: "storage_5gb_1y",
      isTopup: true,
      quotaType: "storage",
      amountUnits: BigInt(5 * 1024 ** 3),
      billingPeriod: "year",
      features: ["+5 GB Storage", "Berlaku 1 Tahun", "Aktif Langsung Setelah Bayar", "Bisa Diperpanjang Kapan Saja"],
      order: 4,
    },
    {
      slug: "storage_10gb_1y",
      name: "Storage +10 GB / Tahun",
      description: "+10 GB kapasitas storage workspace, berlaku 1 tahun sejak aktif.",
      icon: "HardDrive",
      price: 349000,
      yearlyPrice: 349000,
      unit: "once",
      checkoutAlias: "storage_10gb_1y",
      isTopup: true,
      quotaType: "storage",
      amountUnits: BigInt(10 * 1024 ** 3),
      billingPeriod: "year",
      features: ["+10 GB Storage", "Berlaku 1 Tahun", "Aktif Langsung Setelah Bayar", "Bisa Diperpanjang Kapan Saja"],
      order: 5,
    },
    {
      slug: "storage_20gb_1y",
      name: "Storage +20 GB / Tahun",
      description: "+20 GB kapasitas storage workspace, berlaku 1 tahun sejak aktif.",
      icon: "HardDrive",
      price: 599000,
      yearlyPrice: 599000,
      unit: "once",
      checkoutAlias: "storage_20gb_1y",
      isTopup: true,
      quotaType: "storage",
      amountUnits: BigInt(20 * 1024 ** 3),
      billingPeriod: "year",
      features: ["+20 GB Storage", "Berlaku 1 Tahun", "Aktif Langsung Setelah Bayar", "Bisa Diperpanjang Kapan Saja"],
      order: 6,
    },
    {
      slug: "storage_50gb_1y",
      name: "Storage +50 GB / Tahun",
      description: "+50 GB kapasitas storage workspace, berlaku 1 tahun sejak aktif.",
      icon: "HardDrive",
      price: 1299000,
      yearlyPrice: 1299000,
      unit: "once",
      checkoutAlias: "storage_50gb_1y",
      isTopup: true,
      quotaType: "storage",
      amountUnits: BigInt(50 * 1024 ** 3),
      billingPeriod: "year",
      features: ["+50 GB Storage", "Berlaku 1 Tahun", "Aktif Langsung Setelah Bayar", "Bisa Diperpanjang Kapan Saja"],
      order: 7,
    },
    {
      slug: "storage_100gb_1y",
      name: "Storage +100 GB / Tahun",
      description: "+100 GB kapasitas storage workspace, berlaku 1 tahun sejak aktif.",
      icon: "HardDrive",
      price: 2199000,
      yearlyPrice: 2199000,
      unit: "once",
      checkoutAlias: "storage_100gb_1y",
      isTopup: true,
      quotaType: "storage",
      amountUnits: BigInt(100 * 1024 ** 3),
      billingPeriod: "year",
      features: ["+100 GB Storage", "Berlaku 1 Tahun", "Aktif Langsung Setelah Bayar", "Bisa Diperpanjang Kapan Saja"],
      order: 8,
    },
    {
      slug: "storage_1tb_1y",
      name: "Storage +1 TB / Tahun",
      description: "+1 TB kapasitas storage workspace, berlaku 1 tahun sejak aktif.",
      icon: "HardDrive",
      price: 14999000,
      yearlyPrice: 14999000,
      unit: "once",
      checkoutAlias: "storage_1tb_1y",
      isTopup: true,
      quotaType: "storage",
      amountUnits: BigInt(1024 ** 4),
      billingPeriod: "year",
      features: ["+1 TB Storage", "Berlaku 1 Tahun", "Aktif Langsung Setelah Bayar", "Bisa Diperpanjang Kapan Saja"],
      order: 9,
    },
  ]

  for (const a of addons) {
    const existing = await db.addon.findUnique({ where: { slug: a.slug } })
    if (existing) {
      console.log(`  [addons] skip "${a.slug}" — already exists`)
      continue
    }
    await db.addon.create({ data: a })
    console.log(`  [addons] created "${a.slug}"`)
  }
}

async function main() {
  console.log("Seeding pricing catalog (AccountPlan, WorkspacePlan, AiCreditPack, Addon)...")
  await seedAccountPlans()
  await seedWorkspacePlans()
  await seedAiCreditPacks()
  await seedAddons()
  console.log("Done. Existing rows (by slug) were left untouched — edit freely at /admin/pricing.")
}

if (import.meta.main) {
  main()
    .catch((e) => {
      console.error(e)
      process.exit(1)
    })
    .finally(async () => {
      await db.$disconnect()
    })
}
