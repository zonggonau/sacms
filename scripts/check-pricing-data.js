const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Check both sacms-pricing and sacms-addons
  const slugs = ['sacms-pricing', 'sacms-addons'];
  
  for (const slug of slugs) {
    console.log(`\n--- Checking Content Type: ${slug} ---`);
    const ct = await prisma.contentType.findFirst({ where: { slug: slug } });
    if (!ct) {
      console.log(`ContentType ${slug} not found`);
      continue;
    }
    
    const entries = await prisma.contentEntry.findMany({ 
      where: { contentTypeId: ct.id } 
    });
    console.log(`Found ${entries.length} entries.`);
    entries.forEach(e => {
      const data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
      console.log(`- Entry ID: ${e.id}, Status: ${e.status}`);
      console.log(`  Data:`, JSON.stringify(data, null, 2));
    });
  }
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
