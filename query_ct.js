require('dotenv').config();
const { PrismaClient } = require('./prisma/generated-client');
const prisma = new PrismaClient();

async function main() {
  const tenants = await prisma.tenant.findMany({});
  console.log("Found Tenants:", tenants);
}
main().catch(console.error).finally(() => prisma.$disconnect());
