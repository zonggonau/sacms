import { PrismaClient } from './prisma/generated-client/index.js';

const prisma = new PrismaClient();

async function main() {
  const singleTypes = await prisma.singleType.findMany({
    include: { fields: true }
  });
  console.log("SINGLE TYPES:");
  console.log(JSON.stringify(singleTypes, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
