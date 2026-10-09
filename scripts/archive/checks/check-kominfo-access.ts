import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  console.log('Checking kominfo tenant access...\n')

  // Find kominfo tenant
  const kominfo = await prisma.tenant.findUnique({
    where: { slug: 'kominfo' },
  })

  if (!kominfo) {
    console.error('Tenant "kominfo" not found.')
    process.exit(1)
  }

  console.log(`✓ Found tenant: ${kominfo.name} (${kominfo.slug})`)

  // Find kategori content type
  const kategori = await prisma.contentType.findUnique({
    where: { slug: 'kategori' },
    include: {
      fields: {
        orderBy: { order: 'asc' },
      },
    },
  })

  if (!kategori) {
    console.error('Content type "kategori" not found.')
    process.exit(1)
  }

  console.log(`✓ Found content type: ${kategori.name} (${kategori.slug})`)
  console.log(`  Fields: ${kategori.fields.length}\n`)

  // Check if kominfo has access to kategori
  const assignment = await prisma.tenantContentTypeAssignment.findUnique({
    where: {
      tenantId_contentTypeId: {
        tenantId: kominfo.id,
        contentTypeId: kategori.id,
      },
    },
  })

  if (!assignment) {
    console.log('⚠️  Kominfo does NOT have access to "kategori"')
    console.log('   Creating assignment...\n')

    await prisma.tenantContentTypeAssignment.create({
      data: {
        tenantId: kominfo.id,
        contentTypeId: kategori.id,
        enabled: true,
      },
    })

    console.log('✓ Assignment created successfully!')
  } else {
    console.log(`✓ Kominfo has access to "kategori" (enabled: ${assignment.enabled})`)
    
    if (!assignment.enabled) {
      console.log('  Updating to enabled...')
      await prisma.tenantContentTypeAssignment.update({
        where: { id: assignment.id },
        data: { enabled: true },
      })
      console.log('  ✓ Updated to enabled')
    }
  }

  // Check all content types for kominfo
  console.log('\n\nAll content types for kominfo:\n')
  
  const allContentTypes = await prisma.contentType.findMany({
    where: { isPublished: true },
  })

  for (const ct of allContentTypes) {
    const ctAssignment = await prisma.tenantContentTypeAssignment.findUnique({
      where: {
        tenantId_contentTypeId: {
          tenantId: kominfo.id,
          contentTypeId: ct.id,
        },
      },
    })

    if (ctAssignment) {
      console.log(`✓ ${ct.name} (${ct.slug}) - enabled: ${ctAssignment.enabled}`)
    } else {
      console.log(`✗ ${ct.name} (${ct.slug}) - NOT ASSIGNED`)
    }
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })