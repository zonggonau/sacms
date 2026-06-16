import { PrismaClient } from './prisma/generated-client/index.js';

const prisma = new PrismaClient();

async function main() {
  const transactions = await prisma.paymentTransaction.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5,
    include: { subscription: true }
  });
  console.log("RECENT TRANSACTIONS:");
  console.log(JSON.stringify(transactions, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
