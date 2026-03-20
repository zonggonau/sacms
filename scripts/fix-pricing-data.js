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

  console.log(`Found ${entries.length} entries to check.`);

  for (const entry of entries) {
    let data = entry.data;
    if (typeof data === 'string') {
      data = JSON.parse(data);
    }

    let updated = false;

    // Fix spelling
    if (data.name === 'Buisness') {
      data.name = 'Business';
      data.price = 2500000;
      updated = true;
    }

    // Set prices as requested
    if (data.name === 'Starter') {
      data.price = 500000;
      updated = true;
    } else if (data.name === 'Standard') {
      data.price = 500000;
      updated = true;
    } else if (data.name === 'Pro') {
      data.price = 1500000;
      updated = true;
    } else if (data.name === 'Business') {
      data.price = 2500000;
      updated = true;
    }

    if (updated) {
      await prisma.contentEntry.update({
        where: { id: entry.id },
        data: {
          data: JSON.stringify(data)
        }
      });
      console.log(`Updated ${data.name} to Rp ${data.price.toLocaleString()}`);
    }
  }
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
