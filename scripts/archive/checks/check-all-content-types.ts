import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  console.log('Checking all content types...\n')

  const contentTypes = await prisma.contentType.findMany({
    include: {
      fields: {
        orderBy: { order: 'asc' },
      },
    },
  })

  console.log(`Total Content Types: ${contentTypes.length}\n`)

  contentTypes.forEach((ct, index) => {
    console.log(`${index + 1}. ${ct.name} (${ct.slug})`)
    console.log(`   Fields: ${ct.fields.length}`)
    console.log(`   Published: ${ct.isPublished}`)
    console.log(`   Created: ${ct.createdAt}`)
    console.log('')
  })
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })