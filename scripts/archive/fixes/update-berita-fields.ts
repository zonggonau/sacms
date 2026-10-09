import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  console.log('Updating Berita fields properties...\n')

  // Find berita content type
  const berita = await prisma.contentType.findUnique({
    where: { slug: 'berita' },
  })

  if (!berita) {
    console.error('Content type "berita" not found.')
    process.exit(1)
  }

  console.log(`Found content type: ${berita.name} (${berita.slug})\n`)

  // Get all fields
  const fields = await prisma.contentTypeField.findMany({
    where: { contentTypeId: berita.id },
    orderBy: { order: 'asc' },
  })

  console.log(`Total fields: ${fields.length}\n`)

  // Update fields
  for (const field of fields) {
    console.log(`Updating: ${field.name} (${field.slug})`)
    
    let updateData: any = {}

    // Judul Berita - Make required and unique
    if (field.slug === 'judul-berita') {
      updateData = {
        name: 'Judul',
        slug: 'judul',
        required: true,
        unique: true,
      };
    }
    // Desc - Make required
    else if (field.slug === 'desc') {
      updateData = {
        name: 'Ringkasan',
        slug: 'ringkasan',
        required: true,
      };
    }
    // Isi Kontent - Make required and fix slug
    else if (field.slug === 'isi-kontent') {
      updateData = {
        name: 'Isi Konten',
        slug: 'isi-konten',
        required: true,
      };
    }
    // Cover - Make required
    else if (field.slug === 'cover') {
      updateData = {
        name: 'Gambar Cover',
        slug: 'cover',
        required: true,
      };
    }
    // Tanggal Berita - Make required and change to date
    else if (field.slug === 'tanggal-berita') {
      updateData = {
        name: 'Tanggal',
        slug: 'tanggal',
        required: true,
      };
    }
    // Kategori - Already fixed (select with jsonPath)
    else if (field.slug === 'kategori') {
      console.log(`  → Already updated (select with jsonPath)`);
      continue;
    }

    if (Object.keys(updateData).length > 0) {
      await prisma.contentTypeField.update({
        where: { id: field.id },
        data: updateData,
      })
      console.log(`  ✓ Updated`)
    }
  }

  console.log('\n✓ Fields updated successfully!')
  console.log('\n✅ All done!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })