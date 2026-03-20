import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()

async function main() {
  const tenant = await prisma.tenant.findFirst()
  console.log("Using Tenant:", tenant?.name, "ID:", tenant?.id)

  const entries = await prisma.contentEntry.findMany({
    where: {
      contentType: { slug: "platform-pricing" }
    },
    include: { contentType: true }
  })

  console.log("--- DEBUG PRICING ENTRIES ---")
  console.log(JSON.stringify(entries, null, 2))
}
main()
