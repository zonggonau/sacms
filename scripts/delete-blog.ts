import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()
async function main() {
  await prisma.contentType.delete({
    where: { slug: "blog" }
  })
  console.log("Blog content type deleted.")
}
main()
