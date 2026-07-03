import { PrismaClient } from './prisma/generated-client/index.js';
const prisma = new PrismaClient();

async function main() {
  const ct = await prisma.contentType.findFirst({ where: { slug: 'sacms-addons' } });
  console.log(ct);
  const entries = await prisma.contentEntry.findMany({ where: { contentTypeId: ct?.id } });
  console.log("ENTRIES:", entries);
}

main().finally(() => prisma.$disconnect());
