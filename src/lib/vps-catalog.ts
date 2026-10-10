import { db } from "./database"
import { cleanPrice } from "./plan-pricing"
import type { VpsPlanItem } from "@/components/dashboard/services-view"

// Fallback jika belum di-seed di contentEntry. Shared by the global VPS
// catalog page (dashboard/(global)/services) and the per-workspace order
// flow inside Infrastructure > Database & Storage, so both always show the
// exact same plans/pricing instead of two copies drifting apart.
export const FALLBACK_VPS_PLANS: VpsPlanItem[] = [
  {
    id: "vps-plus-4",
    plan_slug: "vps-plus-4",
    name: "Cloud VPS Plus 4 (8GB NVMe)",
    description: "Dedicated Cloud VPS 4 vCPU, 8 GB RAM, 150 GB NVMe untuk database terisolasi dan portal bisnis.",
    price: 700000,
    yearly_price: 7000000,
    features: [
      "4 vCPU Cores & 8 GB RAM",
      "150 GB NVMe SSD Storage",
      "Dedicated PostgreSQL 17 Instance",
      "Full Managed Setup Tim IT Support",
      "Enterprise Cloud Firewall & Auto Backup",
      "Port 1 Gbps & Unmetered Bandwidth",
      "SLA 99.9% Uptime Guarantee"
    ],
    max_storage: 153600,
    max_content_entries: 100000,
    is_popular: false,
    category: "vps"
  },
  {
    id: "vps-plus-6",
    plan_slug: "vps-plus-6",
    name: "Cloud VPS Plus 6 (16GB NVMe)",
    description: "Server dedicated cloud 6 vCPU, 16 GB RAM, 300 GB NVMe untuk sistem media, agensi & SaaS berskala.",
    price: 1240000,
    yearly_price: 12400000,
    features: [
      "6 vCPU Cores & 16 GB RAM",
      "300 GB NVMe SSD Storage",
      "Dedicated PostgreSQL 17 Instance",
      "Full Managed Setup Tim IT Support",
      "Enterprise Cloud Firewall & Auto Backup",
      "Port 1 Gbps & Unmetered Bandwidth",
      "Prioritas 24/7 Dedicated Support"
    ],
    max_storage: 307200,
    max_content_entries: 500000,
    is_popular: true,
    category: "vps"
  },
  {
    id: "vps-plus-8",
    plan_slug: "vps-plus-8",
    name: "Cloud VPS Plus 8 (24GB NVMe)",
    description: "Kapasitas server VPS 8 vCPU, 24 GB RAM, 450 GB NVMe untuk throughput tinggi dan aplikasi multi-tenant.",
    price: 1990000,
    yearly_price: 19900000,
    features: [
      "8 vCPU Cores & 24 GB RAM",
      "450 GB NVMe SSD Storage",
      "Dedicated PostgreSQL 17 Instance",
      "Full Managed Setup Tim IT Support",
      "Enterprise Cloud Firewall & Auto Backup",
      "24/7 Dedicated SRE Support & SLA 99.99%"
    ],
    max_storage: 460800,
    max_content_entries: 1500000,
    is_popular: false,
    category: "vps"
  },
  {
    id: "vds-s",
    plan_slug: "vds-s",
    name: "Gov & Enterprise VDS 3 Cores",
    description: "Dedicated Physical CPU Cores 100% Locked, 24 GB RAM, 180 GB NVMe untuk instansi pemerintah & transaksi kritis.",
    price: 3990000,
    yearly_price: 39900000,
    features: [
      "3 Dedicated Physical CPU Cores (100% Locked)",
      "24 GB RAM & 180 GB NVMe Storage",
      "Dedicated PostgreSQL 17 Appliance",
      "Zero Noisy Neighbor & Zero Contention",
      "Enterprise Cloud Firewall Whitelist",
      "Full Managed Setup & SLA 99.99%"
    ],
    max_storage: 184320,
    max_content_entries: 3000000,
    is_popular: false,
    category: "vds"
  },
  {
    id: "vds-m",
    plan_slug: "vds-m",
    name: "Gov & Enterprise VDS 4 Cores",
    description: "Dedicated 4 Physical Cores, 32 GB RAM, 240 GB NVMe untuk fintech, e-government, dan data compliance.",
    price: 5290000,
    yearly_price: 52900000,
    features: [
      "4 Dedicated Physical CPU Cores (100% Locked)",
      "32 GB RAM & 240 GB NVMe Storage",
      "Dedicated PostgreSQL 17 Appliance",
      "Zero Noisy Neighbor & Zero Contention",
      "Lisensi RSA Enterprise Ready",
      "Dedicated DevOps Engineer & SLA 99.99%"
    ],
    max_storage: 245760,
    max_content_entries: 10000000,
    is_popular: true,
    category: "vds"
  },
  {
    id: "vds-l",
    plan_slug: "vds-l",
    name: "Gov & Enterprise VDS 6 Cores",
    description: "Baremetal-grade performance dengan 6 Physical Cores & 48 GB RAM untuk sistem nasional terpusat.",
    price: 7450000,
    yearly_price: 74500000,
    features: [
      "6 Dedicated Physical CPU Cores (100% Locked)",
      "48 GB RAM & 360 GB NVMe Storage",
      "Dedicated PostgreSQL 17 Enterprise Cluster",
      "Zero Contention Baremetal Architecture",
      "Lisensi Multi-Node Ready",
      "Dedicated 24/7 SRE & DevOps Support"
    ],
    max_storage: 368640,
    max_content_entries: 50000000,
    is_popular: false,
    category: "vds"
  }
]

/**
 * Katalog paket VPS/VDS yang ditampilkan ke user — dari ContentEntry CMS
 * (contentType slug 'sacms-workspace-pricing') kalau sudah di-seed, atau
 * FALLBACK_VPS_PLANS kalau belum/gagal. Dipakai oleh halaman katalog global
 * (dashboard/(global)/services) dan endpoint /api/tenant/[tenant]/vps-catalog
 * yang dipakai tab Infrastructure per-workspace — satu sumber data saja.
 */
export async function getVpsCatalogPlans(): Promise<VpsPlanItem[]> {
  try {
    const entries = await db.contentEntry.findMany({
      where: {
        contentType: { slug: "sacms-workspace-pricing" },
        status: "PUBLISHED",
      },
      select: { id: true, data: true },
    })

    const parsed = entries.map((e) => {
      const d = (typeof e.data === "string" ? JSON.parse(e.data) : e.data) as any
      const price = cleanPrice(d.price)
      const yearlyPrice = d.yearly_price !== undefined ? cleanPrice(d.yearly_price) : price * 10
      const slug = d.plan_slug || e.id

      return {
        id: slug,
        plan_slug: slug,
        name: d.name || "VPS Server",
        description: d.description || d.desc || "",
        desc: d.description || d.desc || "",
        price,
        yearly_price: yearlyPrice,
        max_storage: d.max_storage,
        max_content_entries: d.max_content_entries,
        features: Array.isArray(d.features) ? d.features : [],
        is_popular: Boolean(d.is_popular),
        category: (slug.includes("vds") || (d.name && d.name.toLowerCase().includes("vds")) ? "vds" : "vps") as "vds" | "vps",
      }
    })

    // Saring hanya paket yang berupa VPS, VDS, atau Storage
    const vpsPlansOnly = parsed.filter((p) => {
      const s = `${p.plan_slug} ${p.name}`.toLowerCase()
      return s.includes("vps") || s.includes("vds") || s.includes("storage")
    })

    return vpsPlansOnly.length > 0 ? vpsPlansOnly : FALLBACK_VPS_PLANS
  } catch (err) {
    console.error("[getVpsCatalogPlans] Failed to fetch dynamic VPS plans from CMS:", err)
    return FALLBACK_VPS_PLANS
  }
}
