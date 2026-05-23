const { PrismaClient } = require('./prisma/generated-client');
const prisma = new PrismaClient();

async function main() {
  try {
    const data = await prisma.$queryRawUnsafe(`
      SELECT 
        "id", "documentId", "contentTypeId", "tenantId", "locale", 
        "data", "status", "reviewComment", "publishedAt", 
        "scheduledAt", "archivedAt", "createdBy", "updatedBy", 
        "createdAt", "updatedAt"
      FROM "content_entries" 
      ORDER BY NULLIF("data"->>'step', '')::numeric ASC 
      LIMIT 10
    `);
    console.log('Data count:', data.length);
  } catch(e) {
    console.error('DB ERROR:', e);
  }
}
main();
