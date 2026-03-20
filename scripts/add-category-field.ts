import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  console.log('Adding category field to "berita" content type...')

  // Find berita content type
  const berita = await prisma.contentType.findUnique({
    where: { slug: 'berita' },
  })

  if (!berita) {
    console.error('Content type "berita" not found.')
    process.exit(1)
  }

  console.log(`Found content type: ${berita.name} (${berita.slug})`)

  // Check if category field already exists
  const existingField = await prisma.contentTypeField.findFirst({
    where: {
      contentTypeId: berita.id,
      slug: 'category',
    },
  })

  if (existingField) {
    console.log('Category field already exists. Updating options...')
    
    // Update options
    const newOptions = JSON.stringify(['Kegiatan', 'Kesehatan', 'Politik', 'Berita', 'Pengumuman', 'Artikel', 'Press Release'])
    
    await prisma.contentTypeField.update({
      where: { id: existingField.id },
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
  }
  else {
    console.log('Creating new category field...')
    
    // Create category field
    const categoryField = await prisma.contentTypeField.create({
      data: {
        contentTypeId: berita.id,
        name: 'Kategori',
        slug: 'category',
        type: 'select',
        required: true,
        options: JSON.stringify(['Kegiatan', 'Kesehatan', 'Politik', 'Berita', 'Pengumuman', 'Artikel', 'Press Release']),
        order: 6,
      },
    })
    
    console.log(`✓ Created category field:`)
    console.log(`  Name: ${categoryField.name}`)
    console.log(`  Type: ${categoryField.type}`)
    console.log(`  Required: ${categoryField.required}`)
    console.log(`  Options:`)
    console.log(`    - Kegiatan`)
    console.log(`    - Kesehatan`)
    console.log(`    - Politik`)
    console.log(`    - Berita`)
    console.log(`    - Pengumuman`)
    console.log(`    - Artikel`)
    console.log(`    - Press Release`)
  }

  console.log('\n✓ All done successfully!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })