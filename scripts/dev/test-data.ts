import { PrismaClient } from './prisma/generated-client';

const prisma = new PrismaClient();

async function run() {
  const post = await prisma.contentEntry.findFirst({
    where: { contentType: { slug: 'blog-post' } }
  });
  console.log("DATA:", JSON.stringify(post?.data, null, 2));
}

run().catch(console.error).finally(() => prisma.$disconnect());
