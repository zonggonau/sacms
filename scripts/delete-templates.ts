import { PrismaClient } from '../prisma/generated-client'

const db = new PrismaClient()

async function main() {
  console.log("Looking for 'templates' content type...")
  const templatesType = await db.contentType.findFirst({
    where: { slug: "templates", tenantId: null }
  })

  if (!templatesType) {
    console.log("Templates content type not found.")
    process.exit(0)
  }

  console.log("Found templates content type ID:", templatesType.id)

  const { count } = await db.contentEntry.deleteMany({
    where: {
      contentTypeId: templatesType.id,
    }
  })

  console.log(`Deleted ${count} template entries.`)
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect())
