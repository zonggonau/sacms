const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const entries = await prisma.contentEntry.findMany({
    where: { contentType: { slug: 'templates' } },
    include: { contentType: true }
  });
  console.log(entries.map(e => {
    let d = {};
    try {
      d = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
    } catch {}
    return {
      id: e.id,
      status: e.status,
      tenantId: e.tenantId,
      contentTypeName: e.contentType.name,
      dataName: d.name
    };
  }));
}
main().finally(() => prisma.$disconnect());
