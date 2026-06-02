import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const tId = 'cmpe8r0ba0000ujj8ovklxmms'; // sacms-global
  
  const cts = await prisma.contentType.findMany({
    where: { tenantId: tId }
  });
  console.log("ContentTypes:", cts.map(c => c.slug));

  const sts = await prisma.singleType.findMany({
    where: { tenantId: tId }
  });
  console.log("SingleTypes:", sts.map(c => c.slug));
  
  const ctAssign = await prisma.tenantContentTypeAssignment.findMany({
    where: { tenantId: tId },
    include: { contentType: true }
  });
  console.log("Assigned CTs:", ctAssign.map(a => a.contentType.slug));

  const stAssign = await prisma.tenantSingleTypeAssignment.findMany({
    where: { tenantId: tId },
    include: { singleType: true }
  });
  console.log("Assigned STs:", stAssign.map(a => a.singleType.slug));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
