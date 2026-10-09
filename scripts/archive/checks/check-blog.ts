import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()
async function main() {
  const contentTypes = await prisma.contentType.findMany({
    where: { slug: "blog" }
  })
  console.log(JSON.stringify(contentTypes, null, 2))
}
main()
