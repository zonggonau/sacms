import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  console.log('Adding Status field to Berita content type...\n')

  // Find berita content type
  const berita = await prisma.contentType.findUnique({
    where: { slug: 'berita' },
  })

  if (!berita) {
    console.error('Content type "berita" not found.')
    process.exit(1)
  }

  console.log(`Found content type: ${berita.name} (${berita.slug})`)

  // Check if status field already exists
  const existingField = await prisma.contentTypeField.findFirst({
    where: {
      contentTypeId: berita.id,
      slug: 'status',
    },
  })

  if (existingField) {
    console.log('Status field already exists. Skipping...')
    process.exit(0)
  }

  // Add status field
  const statusField = await prisma.contentTypeField.create({
    data: {
      contentTypeId: berita.id,
      name: 'Status',
      slug: 'status',
      type: 'select',
      required: true,
      unique: false,
      options: JSON.stringify(['Draft', 'Published', 'Archived']),
      order: 7, // Add after tags field
      jsonPath: '/api/statuses', // Optional: Use API for status options
    },
  })

  console.log('✓ Created status field:')
  console.log(`  - Name: ${statusField.name}`)
  console.log(`  - Slug: ${statusField.slug}`)
  console.log(`  - Type: ${statusField.type}`)
  console.log(`  - Required: ${statusField.required}`)
  console.log(`  - Options: Draft, Published, Archived`)
  console.log(`  - Order: ${statusField.order}`)
  console.log(`  - jsonPath: ${statusField.jsonPath}`)
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