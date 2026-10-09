import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()

async function main() {
  console.log("🚀 Adding Add-on Pricing Plans (Backup & Storage)...")

  const ctPricing = await prisma.contentType.findUnique({
    where: { slug: "platform-pricing" }
  })

  if (!ctPricing) {
    console.error("❌ Content Type 'platform-pricing' not found. Please run setup scripts first.")
    return
  }

  // Get a tenant to associate the global pricing with (usually the first one or system tenant)
  const tenant = await prisma.tenant.findFirst()
  if (!tenant) {
    console.error("❌ No tenant found.")
    return
  }

  const addons = [
    { 
      name: "Daily Backup", 
      price: 50000, 
      is_popular: false, 
      features: JSON.stringify(["Automated Daily Backups", "30-day Retention", "Point-in-time Recovery", "One-click Restore"]) 
    },
    { 
      name: "Additional Storage (10GB)", 
      price: 25000, 
      is_popular: false, 
      features: JSON.stringify(["10GB Extra SSD Storage", "High-speed Asset Delivery", "CDN Edge Caching", "No Bandwidth Limits"]) 
    }
  ]

  for (const addon of addons) {
    // Check if it already exists to avoid duplicates
    const existing = await prisma.contentEntry.findFirst({
      where: {
        contentTypeId: ctPricing.id,
        data: {
          path: ['name'],
          equals: addon.name
        }
      }
    })

    if (existing) {
      console.log(`ℹ️ Add-on "${addon.name}" already exists. Skipping.`)
      continue
    }

    await prisma.contentEntry.create({
      data: {
        contentTypeId: ctPricing.id,
        tenantId: tenant.id,
        status: "PUBLISHED",
        data: addon as any
      }
    })
    console.log(`✅ Add-on "${addon.name}" added.`)
  }

  console.log("\n✨ Add-on pricing plans are ready!")
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect())
