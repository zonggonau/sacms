import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  console.log('Assigning content type "kategori" to tenant "demo"...\n')

  // Find demo tenant
  const demo = await prisma.tenant.findUnique({
    where: { slug: 'demo' },
  })

  if (!demo) {
    console.error('Tenant "demo" not found.')
    process.exit(1)
  }

  console.log(`✓ Found tenant: ${demo.name} (${demo.slug})`)

  // Find kategori content type
  const kategori = await prisma.contentType.findUnique({
    where: { slug: 'kategori' },
  })

  if (!kategori) {
    console.error('Content type "kategori" not found.')
    process.exit(1)
  }

  console.log(`✓ Found content type: ${kategori.name} (${kategori.slug})`)

  // Check if assignment already exists
  const existingAssignment = await prisma.tenantContentTypeAssignment.findUnique({
    where: {
      tenantId_contentTypeId: {
        tenantId: demo.id,
        contentTypeId: kategori.id,
      },
    },
  })

  if (existingAssignment) {
    console.log('\nAssignment already exists.')
    console.log(`  Enabled: ${existingAssignment.enabled}`)
    
    // Update to enabled if disabled
    if (!existingAssignment.enabled) {
      await prisma.tenantContentTypeAssignment.update({
        where: { id: existingAssignment.id },
        data: { enabled: true },
      })
      console.log('  ✓ Updated to enabled')
    }
    process.exit(0)
  }

  // Create assignment
  await prisma.tenantContentTypeAssignment.create({
    data: {
      tenantId: demo.id,
      contentTypeId: kategori.id,
      enabled: true,
    },
  })

  console.log('\n✓ Created assignment:')
  console.log(`  - Tenant: ${demo.name}`)
  console.log(`  - Content Type: ${kategori.name}`)
  console.log(`  - Enabled: true`)
  console.log('\n✅ Done! Tenant "demo" now has access to "kategori"')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })