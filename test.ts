import { PrismaClient } from './prisma/generated-client';
const p = new PrismaClient();
async function main() {
  const st = await p.singleType.findFirst({ where: { slug: 'sacms-landing-page' }, include: { tenants: true } });
  console.log("Landing page data:", JSON.stringify(st?.tenants[0]?.data, null, 2));
}
main().finally(() => p.$disconnect());
