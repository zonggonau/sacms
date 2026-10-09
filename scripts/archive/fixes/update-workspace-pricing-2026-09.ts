/**
 * One-off: reprice the 3 workspace plans (Standar/Pro/Business) and retire
 * the free tier's "gratis selamanya" copy — Standar is now a paid entry plan.
 *
 * Run: bun scripts/update-workspace-pricing-2026-09.ts
 */
import { PrismaClient } from "../prisma/generated-client"
const prisma = new PrismaClient()

const UPDATES: Record<string, { price: number; yearly_price: number; name?: string; description?: string; period?: string }> = {
  free: {
    price: 250000,
    yearly_price: 1500000,
    name: "SaCMS Cloud Standar",
    description: "Paket dasar terjangkau untuk memulai proyek CMS profesional Anda.",
    period: "bulan",
  },
  pro: {
    price: 500000,
    yearly_price: 3000000,
  },
  business: {
    price: 830000,
    yearly_price: 5000000,
  },
}

async function main() {
  const ct = await prisma.contentType.findFirst({ where: { slug: "sacms-workspace-pricing" } })
  if (!ct) {
    console.error("sacms-workspace-pricing content type not found")
    return
  }

  const entries = await prisma.contentEntry.findMany({ where: { contentTypeId: ct.id } })
  console.log(`Found ${entries.length} workspace pricing entries.`)

  for (const entry of entries) {
    const data = (typeof entry.data === "string" ? JSON.parse(entry.data) : entry.data) as any
    const slug = data.plan_slug || ""
    const patch = UPDATES[slug]
    if (!patch) continue

    const updatedData = { ...data, ...patch }
    await prisma.contentEntry.update({ where: { id: entry.id }, data: { data: updatedData } })
    console.log(`Updated "${slug}": price=${updatedData.price}, yearly_price=${updatedData.yearly_price}, name=${updatedData.name}`)
  }
}

main().finally(() => prisma.$disconnect())
