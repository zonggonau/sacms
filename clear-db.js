const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  await prisma.contentTypeField.update({
    where: { id: "cmq7w8k5s0003ujfohj8b6x14" },
    data: { options: JSON.stringify({ templateUrl: "" }) }
  });
  console.log("DB Updated: Dummy URL cleared!");
}

main().catch(console.error).finally(() => prisma.$disconnect());
