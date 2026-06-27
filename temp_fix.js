const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  await prisma.contentEntry.updateMany({
    where: { contentType: { slug: 'templates' } },
    data: { tenantId: null }
  });
  console.log('Updated all templates to tenantId: null');
}
main().finally(() => prisma.$disconnect());
