
import { PrismaClient } from "../prisma/generated-client"
const prisma = new PrismaClient()

async function main() {
  const slug = "sacms-features"
  const entries = await prisma.contentEntry.findMany({
    where: { 
      contentType: { slug },
      tenantId: null 
    },
    select: { id: true, status: true, data: true }
  })
  
  console.log(`Found ${entries.length} global entries for ${slug}:`)
  entries.forEach(e => {
    console.log(`- ID: ${e.id}, Status: ${e.status}, Title: ${(e.data as any)?.title || 'N/A'}`)
  })
}

main().finally(() => prisma.$disconnect())
