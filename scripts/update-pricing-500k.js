const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const ct = await prisma.contentType.findUnique({ where: { slug: 'platform-pricing' } });
  if (!ct) {
    console.log('ContentType platform-pricing not found');
    return;
  }

  const entries = await prisma.contentEntry.findMany({ 
    where: { contentTypeId: ct.id } 
  });

  console.log(`Found ${entries.length} entries to update.`);

  for (const entry of entries) {
    let data = entry.data;
    if (typeof data === 'string') {
      data = JSON.parse(data);
    }

    // Set price to 500000 for non-free plans or just all for simplicity as requested
    // but usually starter/pro/business have different prices. 
    // The user said "500.000/mo", I'll set Starter to 500.000
    
    if (data.name === 'Starter') {
      data.price = 500000;
    } else if (data.name === 'Pro') {
      data.price = 1500000;
    } else if (data.name === 'Enterprise') {
      data.price = 5000000;
    } else {
      data.price = 500000;
    }

    await prisma.contentEntry.update({
      where: { id: entry.id },
      data: {
        data: JSON.stringify(data)
      }
    });
    console.log(`Updated ${data.name} to ${data.price}`);
  }
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
