import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  console.log('Adding jsonPath to category field...')

  // Find berita content type
  const berita = await prisma.contentType.findUnique({
    where: { slug: 'berita' },
  })

  if (!berita) {
    console.error('Content type "berita" not found.')
    process.exit(1)
  }

  console.log(`Found content type: ${berita.name} (${berita.slug})`)

  // Find category field
  const categoryField = await prisma.contentTypeField.findFirst({
    where: {
      contentTypeId: berita.id,
      slug: 'category',
    },
  })

  if (!categoryField) {
    console.error('Category field not found.')
    process.exit(1)
  }

  console.log(`Found category field: ${categoryField.name}`)
  console.log(`Current jsonPath: ${categoryField.jsonPath || 'none'}`)

  // Update category field with jsonPath
  await prisma.contentTypeField.update({
    where: { id: categoryField.id },
    data: {
      jsonPath: '/api/categories', // Example API path for categories
    },
  })

  console.log(`✓ Updated category field with jsonPath: /api/categories`)
  console.log('\n✓ Done successfully!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })