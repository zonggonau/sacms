const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const singleTypes = await prisma.singleType.findMany();
  console.log("Single Types:", singleTypes.map(st => st.slug));
  const contentTypes = await prisma.contentType.findMany();
  console.log("Content Types:", contentTypes.map(ct => ct.slug));
}

main().catch(console.error).finally(() => prisma.$disconnect());
