import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  console.log('Updating category options for "berita" content type...')

  // Find the berita content type
  const berita = await prisma.contentType.findUnique({
    where: { slug: 'berita' },
  })

  if (!berita) {
    console.error('Content type "berita" not found.')
    process.exit(1)
  }

  console.log(`Found content type: ${berita.name} (${berita.slug})`)

  // Update category field with new options
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

  const newOptions = JSON.stringify(['Kegiatan', 'Kesehatan', 'Politik', 'Berita', 'Pengumuman', 'Artikel', 'Press Release'])

  await prisma.contentTypeField.update({
    where: { id: categoryField.id },
    data: {
      options: newOptions,
    },
  })

  console.log(`✓ Updated category field options:`)
  console.log(`  - Kegiatan`)
  console.log(`  - Kesehatan`)
  console.log(`  - Politik`)
  console.log(`  - Berita`)
  console.log(`  - Pengumuman`)
  console.log(`  - Artikel`)
  console.log(`  - Press Release`)
  console.log('\n✓ All options updated successfully!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })