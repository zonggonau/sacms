import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  console.log('Updating Kategori field...\n')

  // Find berita content type
  const berita = await prisma.contentType.findUnique({
    where: { slug: 'berita' },
  })

  if (!berita) {
    console.error('Content type "berita" not found.')
    process.exit(1)
  }

  console.log(`Found content type: ${berita.name} (${berita.slug})`)

  // Find kategori field
  const kategoriField = await prisma.contentTypeField.findFirst({
    where: {
      contentTypeId: berita.id,
      slug: 'kategori',
    },
  })

  if (!kategoriField) {
    console.error('Kategori field not found.')
    process.exit(1)
  }

  console.log(`Found kategori field: ${kategoriField.name}`)
  console.log(`Current type: ${kategoriField.type}`)
  console.log(`Current jsonPath: ${kategoriField.jsonPath || 'none'}`)
  console.log('')

  // Update kategori field
  await prisma.contentTypeField.update({
    where: { id: kategoriField.id },
    data: {
      type: 'select', // Change from 'json' to 'select'
      jsonPath: '/api/categories', // Add API path for dynamic options
    },
  })

  console.log('✓ Updated kategori field:')
  console.log(`  - Type: json → select`)
  console.log(`  - jsonPath: /api/categories`)
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