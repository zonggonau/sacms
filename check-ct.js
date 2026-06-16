import { PrismaClient } from './prisma/generated-client/index.js';

const prisma = new PrismaClient();

async function main() {
  const contentTypes = await prisma.contentType.findMany({
    include: { fields: true }
  });
  console.log(JSON.stringify(contentTypes, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
