import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()

async function main() {
  console.log("🚀 Reseeding pricing data with clean JSON...")

  const ct = await prisma.contentType.findUnique({
    where: { slug: "platform-pricing" }
  })

  if (!ct) {
    console.error("❌ Content Type 'platform-pricing' not found.")
    return
  }

  const tenant = await prisma.tenant.findFirst()
  if (!tenant) {
    console.error("❌ No tenant found.")
    return
  }

  // Delete all existing pricing entries
  await prisma.contentEntry.deleteMany({
    where: { contentTypeId: ct.id }
  })

  const plans = [
    { 
      name: "Starter", 
      price: 299000, 
      is_popular: false, 
      type: "plan",
      features: "1 Site, 5 Content Types, 1,000 Entries, 1GB Media Storage, Content Workflow" 
    },
    { 
      name: "Standard", 
      price: 799000, 
      is_popular: false, 
      type: "plan",
      features: "1 Site, 10 Content Types, 5,000 Entries, 3GB Media Storage" 
    },
    { 
      name: "Pro", 
      price: 1499000, 
      is_popular: true, 
      type: "plan",
      features: "1 Site, 20 Content Types, 20,000 Entries, 10GB Media Storage, Content Workflow" 
    },
    { 
      name: "Business", 
      price: 2499000, 
      is_popular: false, 
      type: "plan",
      features: "1 Site, Unlimited Content Types, 50,000 Entries, 25GB Media Storage, Content Workflow" 
    },
    { 
      name: "Daily Backup", 
      price: 50000, 
      is_popular: false, 
      type: "addon",
      features: "Automated Daily Backups, 30-day Retention, Point-in-time Recovery, One-click Restore" 
    },
    { 
      name: "Additional Storage (10GB)", 
      price: 25000, 
      is_popular: false, 
      type: "addon",
      features: "10GB Extra SSD Storage, High-speed Asset Delivery, CDN Edge Caching, No Bandwidth Limits" 
    }
  ]

  for (const p of plans) {
    await prisma.contentEntry.create({
      data: {
        contentTypeId: ct.id,
        tenantId: tenant.id,
        status: "PUBLISHED",
        data: p as any
      }
    })
    console.log(`✅ Entry "${p.name}" created as ${p.type}.`)
  }

  console.log("\n✨ Reseed complete!")
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect())
