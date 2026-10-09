import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  console.log('Assigning "berita" content type to tenant...')

  // Find berita content type
  const berita = await prisma.contentType.findUnique({
    where: { slug: 'berita' },
  })

  if (!berita) {
    console.error('Content type "berita" not found.')
    process.exit(1)
  }

  // Find kominfo tenant
  const kominfo = await prisma.tenant.findUnique({
    where: { slug: 'kominfo' },
  })

  if (!kominfo) {
    console.error('Tenant "kominfo" not found.')
    process.exit(1)
  }

  console.log(`Found: ${berita.name} (${berita.slug}) and ${kominfo.name} (${kominfo.slug})`)

  // Check if already assigned
  const existingAssignment = await prisma.tenantContentTypeAssignment.findUnique({
    where: {
      tenantId_contentTypeId: {
        tenantId: kominfo.id,
        contentTypeId: berita.id,
      },
    },
  })

  if (existingAssignment) {
    console.log('Content type is already assigned to tenant.')
    if (!existingAssignment.enabled) {
      await prisma.tenantContentTypeAssignment.update({
        where: { id: existingAssignment.id },
        data: { enabled: true },
      })
      console.log('✓ Enabled content type for tenant.')
    }
    return
  }

  // Create assignment
  await prisma.tenantContentTypeAssignment.create({
    data: {
      tenantId: kominfo.id,
      contentTypeId: berita.id,
      enabled: true,
    },
  })

  console.log('✓ Successfully assigned content type to tenant!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })