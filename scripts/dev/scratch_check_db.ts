import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const build = await prisma.frontendBuild.findUnique({
    where: { id: 'cms9oldks0003ujkkrpulvgyw' }
  })
  if (build?.generatedFiles) {
    const keys = Object.keys(build.generatedFiles)
    console.log("Files:", keys)
    console.log("App.tsx size:", (build.generatedFiles as any)["App.tsx"]?.length)
    console.log("page.tsx size:", (build.generatedFiles as any)["page.tsx"]?.length)
  }
}

main().catch(console.error).finally(() => prisma.$disconnect())
