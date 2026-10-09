import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  const contentTypes = await prisma.contentType.findMany({
    include: {
      _count: {
        select: { tenants: true }
      },
      tenants: {
        include: {
          tenant: {
            select: { name: true, slug: true }
          }
        }
      }
    }
  })

  console.log(JSON.stringify(contentTypes, null, 2))
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
