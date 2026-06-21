const { PrismaClient } = require('./prisma/generated-client');
const db = new PrismaClient();
async function main() {
  const cts = await db.contentType.findMany({ include: { _count: { select: { entries: true } } } });
  console.log('ContentTypes:', cts.map(c => c.slug + ': ' + c._count.entries));
  const sts = await db.singleType.findMany({ include: { _count: { select: { tenants: true } } } });
  console.log('SingleTypes:', sts.map(c => c.slug + ': ' + c._count.tenants));
}
main().catch(console.error).finally(() => db.$disconnect());
