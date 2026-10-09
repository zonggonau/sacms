import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  console.log('Setting up Berita content type...\n')

  // Check if berita content type already exists
  const existingBerita = await prisma.contentType.findUnique({
    where: { slug: 'berita' },
  })

  if (existingBerita) {
    console.log('Content type "berita" already exists.')
    console.log(`ID: ${existingBerita.id}`)
    console.log(`Fields: ${existingBerita.name}`)
    process.exit(0)
  }

  // Create berita content type
  const berita = await prisma.contentType.create({
    data: {
      name: 'Berita',
      slug: 'berita',
      description: 'Content type untuk berita dan artikel',
      isPublished: true,
    },
  })

  console.log(`✓ Created content type: ${berita.name} (${berita.slug})`)
  console.log(`  ID: ${berita.id}\n`)

  // Define fields
  const fields = [
    {
      name: 'Judul',
      slug: 'judul',
      type: 'text',
      required: true,
      unique: true,
      order: 1,
    },
    {
      name: 'Ringkasan',
      slug: 'ringkasan',
      type: 'textarea',
      required: true,
      order: 2,
    },
    {
      name: 'Isi Konten',
      slug: 'isi-konten',
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
      slug: 'penulis',
      type: 'text',
      required: false,
      order: 5,
    },
    {
      name: 'Tags',
      slug: 'tags',
      type: 'text',
      required: false,
      order: 6,
    },
    {
      name: 'Kategori',
      slug: 'kategori',
      type: 'select',
      required: true,
      jsonPath: '/api/categories',
      order: 7,
    },
    {
      name: 'Status',
      slug: 'status',
      type: 'select',
      required: true,
      options: JSON.stringify(['Draft', 'Published', 'Archived']),
      jsonPath: '/api/statuses',
      order: 8,
    },
  ]

  console.log('Creating fields...\n')

  // Create fields
  for (const field of fields) {
    await prisma.contentTypeField.create({
      data: {
        contentTypeId: berita.id,
        ...field,
      },
    })
    console.log(`✓ Created field: ${field.name} (${field.slug})`)
  }

  console.log(`\n✓ Total fields created: ${fields.length}`)

  // Find kominfo tenant
  const kominfo = await prisma.tenant.findUnique({
    where: { slug: 'cc29bc2250' },
  })

  if (!kominfo) {
    console.log('\n⚠️  Tenant "kominfo" not found. Skipping assignment...')
  } else {
    console.log(`\n✓ Found tenant: ${kominfo.name} (${kominfo.slug})`)
    
    // Assign content type to tenant
    await prisma.tenantContentTypeAssignment.create({
      data: {
        tenantId: kominfo.id,
        contentTypeId: berita.id,
        enabled: true,
      },
    })
    console.log(`✓ Assigned content type to tenant "kominfo"`)
  }

  console.log('\n✅ Setup completed successfully!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })