const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const ct = await prisma.contentType.findUnique({ where: { slug: 'platform-pricing' } });
  if (!ct) {
    console.log('ContentType not found');
    return;
  }
  const entries = await prisma.contentEntry.findMany({ 
    where: { contentTypeId: ct.id } 
  });
  console.log(JSON.stringify(entries, null, 2));
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
