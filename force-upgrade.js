import { PrismaClient } from './prisma/generated-client/index.js';

const prisma = new PrismaClient();

async function main() {
  const userId = "cmpwfdl2z004cujd4vvr10kfu"
  await prisma.user.update({
    where: { id: userId },
    data: { plan: "starter" }
  });
  
  await prisma.subscription.updateMany({
    where: { userId: userId, tenantId: null, plan: "starter" },
    data: { status: "active" }
  })
  console.log("Updated user plan to starter and activated subscription!");
}

main().catch(console.error).finally(() => prisma.$disconnect());
