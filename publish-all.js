const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const result = await prisma.contentType.updateMany({
    data: { isPublished: true }
  });
  console.log(`Updated ${result.count} content types to PUBLISHED.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
