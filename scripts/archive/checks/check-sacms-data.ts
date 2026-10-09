import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  const slugs = ["sacms-hero", "sacms-features", "sacms-pricing", "sacms-addons", "sacms-workflow", "sacms-faq", "sacms-whatsapp", "sacms-about", "sacms-owners", "sacms-testimonials"]
  
  console.log("Checking SaCMS Content Types and Entries...")
  
  for (const slug of slugs) {
    const contentType = await prisma.contentType.findFirst({
      where: { slug }
    })
    
    if (!contentType) {
      console.log(`\n[${slug}] Content Type NOT FOUND`)
      continue
    }
    
    const entries = await prisma.contentEntry.findMany({
      where: { contentTypeId: contentType.id },
      include: { contentType: true }
    })
    
    console.log(`\n[${slug}] Content Type ID: ${contentType.id}`)
    console.log(`Entries count: ${entries.length}`)
    
    entries.forEach(entry => {
      console.log(`- Entry ID: ${entry.id}, Status: ${entry.status}`)
      try {
        const data = typeof entry.data === 'string' ? JSON.parse(entry.data) : entry.data
        console.log(`  Data: ${JSON.stringify(data).substring(0, 100)}...`)
      } catch (e) {
        console.log(`  Data (raw): ${String(entry.data).substring(0, 100)}...`)
      }
    })
  }
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
