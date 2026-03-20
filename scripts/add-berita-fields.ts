import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  console.log('Adding fields to "berita" content type...')

  // Find the berita content type
  const berita = await prisma.contentType.findUnique({
    where: { slug: 'berita' },
  })

  if (!berita) {
    console.error('Content type "berita" not found. Please create it first.')
    process.exit(1)
  }

  console.log(`Found content type: ${berita.name} (${berita.slug})`)

  // Define fields for berita
  const fields = [
    {
      name: 'Judul',
      slug: 'title',
      type: 'text',
      required: true,
      unique: true,
      order: 1,
    },
    {
      name: 'Ringkasan',
      slug: 'description',
      type: 'textarea',
      required: true,
      order: 2,
    },
    {
      name: 'Isi Konten',
      slug: 'content',
      type: 'richText',
      required: true,
      order: 3,
    },
    {
      name: 'Gambar Cover',
      slug: 'cover',
      type: 'media',
      required: false,
      order: 4,
    },
    {
      name: 'Penulis',
      slug: 'author',
      type: 'text',
      required: false,
      order: 5,
    },
    {
      name: 'Kategori',
      slug: 'category',
      type: 'select',
      required: true,
      options: JSON.stringify(['Berita', 'Pengumuman', 'Artikel', 'Press Release']),
      order: 6,
    },
    {
      name: 'Tags',
      slug: 'tags',
      type: 'text',
      required: false,
      order: 7,
    },
    {
      name: 'Status',
      slug: 'status',
      type: 'select',
      required: true,
      options: JSON.stringify(['Draft', 'Published', 'Archived']),
      order: 8,
    },
  ]

  // Add fields
  for (const field of fields) {
    try {
      const existingField = await prisma.contentTypeField.findUnique({
        where: {
          contentTypeId_slug: {
            contentTypeId: berita.id,
            slug: field.slug,
          },
        },
      })

      if (existingField) {
        console.log(`Field "${field.slug}" already exists, skipping...`)
        continue
      }

      await prisma.contentTypeField.create({
        data: {
          contentTypeId: berita.id,
          ...field,
        },
      })

      console.log(`✓ Added field: ${field.name} (${field.slug})`)
    } catch (error) {
      console.error(`✗ Failed to add field "${field.slug}":`, error)
    }
  }

  console.log('\n✓ All fields added successfully!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })