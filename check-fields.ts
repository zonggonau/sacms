import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const tId = 'cmpe8r0ba0000ujj8ovklxmms';

  const hero = await prisma.singleType.findFirst({
    where: { tenantId: tId, slug: 'sacms-hero' },
    include: { fields: true }
  });
  console.log("Hero fields:", hero?.fields.map(f => `${f.slug} (${f.type})`));

  const features = await prisma.contentType.findFirst({
    where: { tenantId: tId, slug: 'sacms-features' },
    include: { fields: true }
  });
  console.log("Features fields:", features?.fields.map(f => `${f.slug} (${f.type})`));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
