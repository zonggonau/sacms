import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()

async function main() {
  console.log("🚀 Reseeding pricing data for SaCMS Landing Page...")

  const ct = await prisma.contentType.findFirst({
    where: { slug: "sacms-pricing" }
  })

  if (!ct) {
    console.error("❌ Content Type 'sacms-pricing' not found.")
    return
  }

  const tenant = await prisma.tenant.findFirst({
    where: { slug: "sacms-global" } // Usually stored in global tenant
  }) || await prisma.tenant.findFirst()

  if (!tenant) {
    console.error("❌ No tenant found for seeding.")
    return
  }

  // Delete all existing pricing entries
  await prisma.contentEntry.deleteMany({
    where: { contentTypeId: ct.id }
  })

  const plans = [
    { 
      name: "Free", 
      price: 0, 
      is_popular: false, 
      description: "Untuk individu yang baru memulai.",
      button_text: "Daftar Gratis",
      features_list: "1 Workspace, 100MB Storage, 5 Content Types, 1,000 Entries, Community Support" 
    },
    { 
      name: "Standar", 
      price: 299000, 
      is_popular: true, 
      description: "Pilihan terbaik untuk tim kecil.",
      button_text: "Mulai Standar",
      features_list: "5 Workspaces, 1GB Storage per Workspace, 20 Content Types, 10,000 Entries, Email Support" 
    },
    { 
      name: "Profesional", 
      price: 799000, 
      is_popular: false, 
      description: "Untuk bisnis yang sedang berkembang.",
      button_text: "Mulai Profesional",
      features_list: "20 Workspaces, 5GB Storage per Workspace, Unlimited Content Types, 50,000 Entries, Priority Support, AI Enabled" 
    },
    { 
      name: "Bisnis", 
      price: 1499000, 
      is_popular: false, 
      description: "Infrastruktur konten skala besar.",
      button_text: "Mulai Bisnis",
      features_list: "50 Workspaces, 20GB Storage per Workspace, Unlimited Everything, 24/7 Support, Custom Workflow, AI Tools" 
    },
    { 
      name: "Unlimited", 
      price: "Hubungi Kami", 
      is_popular: false, 
      description: "Kebutuhan kustom untuk organisasi besar.",
      button_text: "Hubungi Kami",
      features_list: "Unlimited Workspaces, 100GB+ Storage, Dedicated Infrastructure, Custom SLA, On-premise Option" 
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
    console.log(`✅ Entry "${p.name}" created.`)
  }

  console.log("\n✨ Reseed complete!")
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect())
