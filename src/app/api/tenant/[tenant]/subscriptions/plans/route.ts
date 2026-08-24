import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/database"
import { getGlobalWorkspaceId } from "@/lib/settings"

export const dynamic = "force-dynamic"

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ tenant: string }> }
) {
  try {
    const { tenant } = await context.params
    const isAccount = tenant === "account"
    const globalTenantId = await getGlobalWorkspaceId()

    // 1. Fetch Pricing Content Type
    const pricingContentType = await db.contentType.findFirst({
      where: { 
        slug: isAccount ? "sacms-account-pricing" : "sacms-workspace-pricing",
        tenantId: null 
      }
    })

    // 2. Fetch SaCMS Addons
    const addonContentType = await db.contentType.findFirst({
      where: { slug: "sacms-addons", tenantId: null }
    })

    const cleanPrice = (val: any) => {
      if (typeof val === 'number') return val
      if (typeof val === 'string') return parseInt(val.replace(/[^\d]/g, ''), 10) || 0
      return 0
    }

    const parseFeatures = (val: any) => {
      if (Array.isArray(val)) return val
      if (typeof val === 'string' && val.trim().length > 0) {
        if (val.startsWith('[') && val.endsWith(']')) {
          try {
            const parsed = JSON.parse(val)
            if (Array.isArray(parsed)) return parsed
          } catch (e) {}
        }
        return val.split(',').map(s => s.trim())
      }
      return []
    }

    let workspacePlans: any[] = []

    // ─── LOAD WORKSPACE / ACCOUNT PLANS DYNAMICALLY FROM GLOBAL CMS ───
    if (pricingContentType) {
      const pricingEntries = await db.contentEntry.findMany({
        where: {
          contentTypeId: pricingContentType.id,
          status: "PUBLISHED",
          tenantId: globalTenantId
        },
        orderBy: { createdAt: "asc" }
      })

      if (pricingEntries.length > 0) {
        workspacePlans = pricingEntries.map(entry => {
          const d = (typeof entry.data === 'string' ? JSON.parse(entry.data) : entry.data) as any
          const numericPrice = cleanPrice(d.price)

          let yearlyPrice = 0
          if (d.yearly_price !== undefined) {
            if (typeof d.yearly_price === 'string') {
              yearlyPrice = parseInt(d.yearly_price.replace(/[^\d]/g, ''), 10) || 0
            } else {
              yearlyPrice = Number(d.yearly_price) || 0
            }
          } else {
            yearlyPrice = numericPrice * 10
          }

          return {
            id: d.plan_slug || entry.id,
            name: d.name || "Unnamed Plan",
            description: d.description || "",
            type: isAccount ? "account" : "workspace",
            price: numericPrice,
            yearlyPrice: yearlyPrice,
            features: parseFeatures(d.features),
            popular: d.is_popular === true || d.popular === true || d.plan_slug === "pro" || d.plan_slug === "vds-s",
            buttonText: d.cta_text || "Pilih Paket",
            maxContentTypes: parseInt(d.max_content_types, 10) || 0,
            maxContentEntries: parseInt(d.max_content_entries, 10) || 0,
            maxTeamMembers: parseInt(d.max_team_members, 10) || 0,
            maxApiCalls: parseInt(d.max_api_calls, 10) || 0,
            maxStorage: parseInt(d.max_storage, 10) || 0,
            maxLocales: parseInt(d.max_locales, 10) || 0,
            auditLogRetention: parseInt(d.audit_log_retention, 10) || 0,
            supportLevel: d.support_level || (d.plan_slug?.includes("vds") ? "Dedicated DevOps & 99.99% SLA" : d.plan_slug?.includes("vps") ? "24/7 Dedicated SLA" : d.plan_slug === "enterprise" ? "Prioritas & SLA" : d.plan_slug === "pro" ? "Prioritas" : "Email")
          }
        })

        const PLAN_ORDER: Record<string, number> = { 
          free: 1, 
          starter: 2, 
          pro: 3, 
          enterprise: 4, 
          "vps-s": 5, 
          "vps-m": 6, 
          "vps-l": 7, 
          "vds-s": 8, 
          "vds-m": 9, 
          "vds-l": 10
        }
        workspacePlans.sort((a, b) => (PLAN_ORDER[a.id] || 99) - (PLAN_ORDER[b.id] || 99) || a.price - b.price)
      }
    }

    // Fallback ONLY when database has 0 published entries
    if (workspacePlans.length === 0) {
      if (isAccount) {
        workspacePlans = [
          {
            id: "account_free",
            name: "Free Account",
            type: "account",
            price: 0,
            yearlyPrice: 0,
            features: ["1 Workspace Included", "Full CMS Studio Access", "Community Support"],
            popular: false,
            buttonText: "Paket Dasar",
            maxWorkspaces: 1
          },
          {
            id: "account_starter",
            name: "Starter Account",
            type: "account",
            price: 199000,
            yearlyPrice: 1990000,
            features: ["Hingga 3 Workspace", "Akses API & Webhook", "Dukungan Email"],
            popular: false,
            buttonText: "Pilih Starter",
            maxWorkspaces: 3
          },
          {
            id: "account_pro",
            name: "Pro Account",
            type: "account",
            price: 499000,
            yearlyPrice: 4990000,
            features: ["Hingga 10 Workspace", "Dukungan Prioritas", "Akses Fitur Pro"],
            popular: true,
            buttonText: "Pilih Pro",
            maxWorkspaces: 10
          },
          {
            id: "account_enterprise",
            name: "Enterprise Account",
            type: "account",
            price: 1499000,
            yearlyPrice: 14990000,
            features: ["Hingga 20 Workspace", "Dedicated Account Manager", "SLA 99.9%"],
            popular: false,
            buttonText: "Pilih Enterprise",
            maxWorkspaces: 20
          }
        ]
      } else {
        workspacePlans = [
          {
            id: "free",
            name: "SaCMS Free Forever",
            type: "workspace",
            price: 0,
            yearlyPrice: 0,
            features: ["3 Tipe Konten", "1.000 Request API/bulan", "100MB Penyimpanan", "1 Anggota Tim"],
            popular: false,
            buttonText: "Current Plan",
            maxContentTypes: 3,
            maxContentEntries: 500,
            maxTeamMembers: 1,
            maxApiCalls: 1000,
            maxStorage: 100,
            maxLocales: 1,
            auditLogRetention: 0,
            supportLevel: "Community"
          },
          {
            id: "starter",
            name: "SaCMS Cloud Starter",
            description: "Paket ekonomis untuk UMKM, blog, dan portfolio pribadi",
            type: "workspace",
            price: 49000,
            yearlyPrice: 490000,
            features: ["5 Tipe Konten", "5.000 Entri Konten", "3 Anggota Tim", "10.000 API Calls/bln", "1 GB Storage"],
            popular: false,
            buttonText: "Pilih Starter",
            maxContentTypes: 5,
            maxContentEntries: 5000,
            maxTeamMembers: 3,
            maxApiCalls: 10000,
            maxStorage: 1024,
            maxLocales: 2,
            auditLogRetention: 7,
            supportLevel: "Email"
          },
          {
            id: "pro",
            name: "SaCMS Cloud Pro",
            description: "Performa tinggi ekonomis untuk agensi dan startup berkembang",
            type: "workspace",
            price: 149000,
            yearlyPrice: 1490000,
            features: ["10 Tipe Konten", "10.000 Entri Konten", "10 Anggota Tim", "100.000 API Calls/bln", "5 GB Storage", "Prioritas Support"],
            popular: true,
            buttonText: "Pilih Pro",
            maxContentTypes: 10,
            maxContentEntries: 10000,
            maxTeamMembers: 10,
            maxApiCalls: 100000,
            maxStorage: 5120,
            maxLocales: 5,
            auditLogRetention: 30,
            supportLevel: "Prioritas"
          },
          {
            id: "enterprise",
            name: "SaCMS Cloud Enterprise",
            description: "Multi-tenant cloud kapasitas besar untuk tim korporat",
            type: "workspace",
            price: 399000,
            yearlyPrice: 3990000,
            features: ["20 Tipe Konten", "20.000 Entri Konten", "20 Anggota Tim", "1.000.000 API Calls/bln", "10 GB Storage", "24/7 Support"],
            popular: false,
            buttonText: "Pilih Enterprise Cloud",
            maxContentTypes: 20,
            maxContentEntries: 20000,
            maxTeamMembers: 20,
            maxApiCalls: 1000000,
            maxStorage: 10240,
            maxLocales: 20,
            auditLogRetention: 365,
            supportLevel: "24/7 Dedicated Support"
          },
          {
            id: "vps-s",
            name: "SaCMS Business VPS S",
            description: "Dedicated Cloud Server (4 vCPU, 8 GB RAM, 75 GB NVMe) + PostgreSQL 17 + MinIO S3",
            type: "workspace",
            price: 1250000,
            yearlyPrice: 12500000,
            features: [
              "Dedicated Cloud VPS (4 vCPU, 8 GB RAM, 75 GB NVMe)",
              "Dedicated PostgreSQL 17 Database Server",
              "Dedicated MinIO S3 Object Storage (75 GB)",
              "Auto Let's Encrypt SSL & Reverse Proxy",
              "500.000 Entri Konten & Unlimited Schemas",
              "50 Anggota Tim & 365 Hari Audit Retention",
              "Prioritas 24/7 Support & SLA 99.9%"
            ],
            popular: false,
            buttonText: "Pilih VPS S",
            maxContentTypes: 999999,
            maxContentEntries: 500000,
            maxTeamMembers: 50,
            maxApiCalls: 10000000,
            maxStorage: 76800,
            maxLocales: 50,
            auditLogRetention: 365,
            supportLevel: "24/7 Dedicated SLA"
          },
          {
            id: "vps-m",
            name: "SaCMS Business VPS M",
            description: "Dedicated Cloud Server (6 vCPU, 16 GB RAM, 150 GB NVMe) untuk portal media & traffic tinggi",
            type: "workspace",
            price: 2450000,
            yearlyPrice: 24500000,
            features: [
              "Dedicated Cloud VPS (6 vCPU, 16 GB RAM, 150 GB NVMe)",
              "Dedicated PostgreSQL 17 + MinIO S3 (150 GB)",
              "Port Bandwidth 400 Mbps",
              "1.000.000 Entri Konten & Unlimited Schemas",
              "75 Anggota Tim & 365 Hari Audit Retention",
              "Dukungan Prioritas 24/7 & SLA 99.9%"
            ],
            popular: false,
            buttonText: "Pilih VPS M",
            maxContentTypes: 999999,
            maxContentEntries: 1000000,
            maxTeamMembers: 75,
            maxApiCalls: 25000000,
            maxStorage: 153600,
            maxLocales: 75,
            auditLogRetention: 365,
            supportLevel: "24/7 Dedicated SLA"
          },
          {
            id: "vps-l",
            name: "SaCMS Business VPS L",
            description: "Dedicated Cloud Server (8 vCPU, 24 GB RAM, 300 GB NVMe) untuk platform konten & e-commerce masif",
            type: "workspace",
            price: 3450000,
            yearlyPrice: 34500000,
            features: [
              "Dedicated Cloud VPS (8 vCPU, 24 GB RAM, 300 GB NVMe)",
              "Dedicated PostgreSQL 17 + MinIO S3 (300 GB)",
              "Port Bandwidth 600 Mbps",
              "2.000.000 Entri Konten & Unlimited Schemas",
              "100 Anggota Tim & 365 Hari Audit Retention",
              "Dukungan Prioritas 24/7 & SLA 99.9%"
            ],
            popular: false,
            buttonText: "Pilih VPS L",
            maxContentTypes: 999999,
            maxContentEntries: 2000000,
            maxTeamMembers: 100,
            maxApiCalls: 50000000,
            maxStorage: 307200,
            maxLocales: 100,
            auditLogRetention: 365,
            supportLevel: "24/7 Dedicated SLA"
          },
          {
            id: "vds-s",
            name: "SaCMS Gov VDS S (Dedicated CPU)",
            description: "Dedicated Enterprise VDS dengan 3 Dedicated Physical Cores (24 GB RAM, 180 GB NVMe) untuk Instansi Pemerintah & Fintech",
            type: "workspace",
            price: 4500000,
            yearlyPrice: 45000000,
            features: [
              "Dedicated VDS (3 Dedicated Cores, 24 GB RAM, 180 GB NVMe)",
              "100% Dedicated Physical CPU Lock (No Noisy Neighbor)",
              "Dedicated PostgreSQL 17 + MinIO S3 (180 GB)",
              "Port Bandwidth 250 Mbps Dedicated",
              "Pilihan Region Datacenter Terisolasi",
              "3.000.000 Entri Konten & Unlimited Schemas",
              "150 Anggota Tim & 730 Hari Audit Retention",
              "Dedicated DevOps Support & SLA 99.99%"
            ],
            popular: true,
            buttonText: "Pilih VDS S",
            maxContentTypes: 999999,
            maxContentEntries: 3000000,
            maxTeamMembers: 150,
            maxApiCalls: 75000000,
            maxStorage: 184320,
            maxLocales: 150,
            auditLogRetention: 730,
            supportLevel: "Dedicated DevOps & 99.99% SLA"
          },
          {
            id: "vds-m",
            name: "SaCMS Gov VDS M (Dedicated CPU)",
            description: "Dedicated Enterprise VDS dengan 4 Dedicated Physical Cores (32 GB RAM, 240 GB NVMe) untuk beban transaksi kritis nasional",
            type: "workspace",
            price: 6500000,
            yearlyPrice: 65000000,
            features: [
              "Dedicated VDS (4 Dedicated Cores, 32 GB RAM, 240 GB NVMe)",
              "100% Dedicated CPU Lock & High IOPS NVMe",
              "Dedicated PostgreSQL 17 + MinIO S3 (240 GB)",
              "Port Bandwidth 500 Mbps Dedicated",
              "5.000.000 Entri Konten & Unlimited Schemas",
              "200 Anggota Tim & 730 Hari Audit Retention",
              "Dedicated DevOps Support & SLA 99.99%"
            ],
            popular: false,
            buttonText: "Pilih VDS M",
            maxContentTypes: 999999,
            maxContentEntries: 5000000,
            maxTeamMembers: 200,
            maxApiCalls: 100000000,
            maxStorage: 245760,
            maxLocales: 200,
            auditLogRetention: 730,
            supportLevel: "Dedicated DevOps & 99.99% SLA"
          },
          {
            id: "vds-l",
            name: "SaCMS Gov VDS L (Dedicated CPU)",
            description: "Dedicated Enterprise VDS dengan 6 Dedicated Physical Cores (48 GB RAM, 360 GB NVMe) untuk performa ekstrim skala kementerian/BUMN",
            type: "workspace",
            price: 9500000,
            yearlyPrice: 95000000,
            features: [
              "Dedicated VDS (6 Dedicated Cores, 48 GB RAM, 360 GB NVMe)",
              "100% Dedicated Physical Cores & Extreme Throughput",
              "Dedicated PostgreSQL 17 + MinIO S3 (360 GB)",
              "Port Bandwidth 750 Mbps Dedicated",
              "10.000.000 Entri Konten & Unlimited Schemas",
              "500 Anggota Tim & 730 Hari Audit Retention",
              "Dedicated DevOps Support & SLA 99.99%"
            ],
            popular: false,
            buttonText: "Pilih VDS L",
            maxContentTypes: 999999,
            maxContentEntries: 10000000,
            maxTeamMembers: 500,
            maxApiCalls: 200000000,
            maxStorage: 368640,
            maxLocales: 500,
            auditLogRetention: 730,
            supportLevel: "Dedicated DevOps & 99.99% SLA"
          }
        ]
      }
    }

    // ─── LOAD ADDONS DYNAMICALLY FROM GLOBAL CMS ───
    let addonPlans: any[] = []

    if (addonContentType) {
      const addonEntries = await db.contentEntry.findMany({
        where: {
          contentTypeId: addonContentType.id,
          status: "PUBLISHED",
          tenantId: globalTenantId
        },
        orderBy: { createdAt: "asc" }
      })

      if (addonEntries.length > 0) {
        addonPlans = addonEntries.map(entry => {
          const d = (typeof entry.data === 'string' ? JSON.parse(entry.data) : entry.data) as any
          const numericPrice = cleanPrice(d.price)
          const isTopup = d.is_topup === true || d.is_topup === "true" || d.unit === "once"

          return {
            id: d.addon_slug || entry.id,
            name: d.name || "Unnamed Addon",
            type: "addons",
            price: numericPrice,
            priceLabel: d.price_label || "",
            features: d.description ? [d.description] : (Array.isArray(d.features) ? d.features : ["Feature upgrade"]),
            popular: false,
            buttonText: d.price_label ? (numericPrice === 0 ? "Included" : "Activate") : (isTopup ? "Top Up Now" : "Activate"),
            icon: d.icon || "Package",
            isTopup: isTopup
          }
        })
      }
    }

    // Fallback addons only if CMS has 0 addon entries
    if (addonPlans.length === 0) {
      addonPlans = [
        {
          id: "topup_ai_500k",
          name: "AI Booster (500K Tokens)",
          type: "addons",
          price: 25000,
          features: ["+500.000 Extra AI Tokens", "No expiration date", "Works with all AI Writers & Generators"],
          popular: true,
          buttonText: "Top Up Now",
          icon: "Bot",
          isTopup: true,
          quotaType: "ai_tokens",
          amountUnits: 500000
        },
        {
          id: "topup_ai_2m",
          name: "AI Power Pack (2M Tokens)",
          type: "addons",
          price: 75000,
          features: ["+2.000.000 Extra AI Tokens", "Best value for content teams", "Priority generation speed"],
          popular: false,
          buttonText: "Top Up Now",
          icon: "Zap",
          isTopup: true,
          quotaType: "ai_tokens",
          amountUnits: 2000000
        },
        {
          id: "topup_storage_10gb",
          name: "Extra Storage (10 GB)",
          type: "addons",
          price: 35000,
          features: ["+10 GB Cloud Storage", "Permanent storage boost", "Instant activation"],
          popular: false,
          buttonText: "Top Up Now",
          icon: "HardDrive",
          isTopup: true,
          quotaType: "storage",
          amountUnits: 10 * 1024 * 1024 * 1024
        },
        {
          id: "topup_api_500k",
          name: "Extra API Quota (500K Calls)",
          type: "addons",
          price: 30000,
          features: ["+500.000 API Requests", "Burst traffic support", "No throttle guarantee"],
          popular: false,
          buttonText: "Top Up Now",
          icon: "Database",
          isTopup: true,
          quotaType: "api_calls",
          amountUnits: 500000
        }
      ]
    }

    const plans = [...workspacePlans, ...addonPlans]

    return NextResponse.json({ plans })
  } catch (error) {
    console.error("Error fetching pricing plans:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
