import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const builds = await prisma.frontendBuild.findMany({
    orderBy: { updatedAt: "desc" },
    take: 20
  });

  for (const build of builds) {
    const files = (build.generatedFiles as Record<string, string>) || {};
    const fileCount = Object.keys(files).length;
    console.log(`Build: ${build.id}, status: ${build.status}, files: ${fileCount}`);
    if (fileCount > 0) {
      for (const [filepath, content] of Object.entries(files)) {
         if (filepath === 'src/app/layout.tsx') {
           console.log(content.slice(0, 500));
         }
      }
    }
  }
}

main().finally(() => prisma.$disconnect());
