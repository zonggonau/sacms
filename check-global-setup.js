const { PrismaClient } = require('./prisma/generated-client');
const prisma = new PrismaClient();
const crypto = require('crypto');

async function main() {
  const token = "cf_cc0045e6f75d9cb58a5a81a4b03dbc5602258b70c06c5c6ce8be304e9474b5fd";
  const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

  console.log("Token:", token);
  console.log("Hashed Token:", hashedToken);

  const apiToken = await prisma.apiToken.findUnique({
    where: { token: hashedToken }
  });
  console.log("ApiToken in DB:", apiToken);

  const systemApiKey = await prisma.setting.findUnique({
    where: { key: "systemApiKey" }
  });
  console.log("systemApiKey in Settings:", systemApiKey);

  const allTenants = await prisma.tenant.findMany();
  console.log("Tenants count:", allTenants.length);
  
  const globalEntries = await prisma.contentEntry.findMany({
    where: { tenantId: null },
    include: { contentType: { select: { slug: true } } }
  });
  console.log("Global Content Entries count:", globalEntries.length);
  const types = [...new Set(globalEntries.map(e => e.contentType.slug))];
  console.log("Global Content Types found in entries:", types);

  await prisma.$disconnect();
}

main();
