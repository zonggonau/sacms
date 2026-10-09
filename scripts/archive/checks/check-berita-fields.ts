import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  console.log('Checking Berita content type fields...\n')

  const berita = await prisma.contentType.findUnique({
    where: { slug: 'berita' },
    include: {
      fields: {
        orderBy: { order: 'asc' },
      },
    },
  })

  if (!berita) {
    console.error('Content type "berita" not found.')
    process.exit(1)
  }

  console.log(`Content Type: ${berita.name} (${berita.slug})`)
  console.log(`Total Fields: ${berita.fields.length}\n`)
  
  console.log('Fields:')
  berita.fields.forEach((field, index) => {
    console.log(`${index + 1}. ${field.name} (${field.slug})`)
    console.log(`   Type: ${field.type}`)
    console.log(`   Required: ${field.required}`)
    console.log(`   Options: ${field.options || 'none'}`)
    console.log(`   jsonPath: ${field.jsonPath || 'none'}`)
    console.log(`   relationSlug: ${field.relationSlug || 'none'}`)
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