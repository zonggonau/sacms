import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  console.log('Assigning all content types to tenant "demo"...\n')

  // Find demo tenant
  const demo = await prisma.tenant.findUnique({
    where: { slug: 'demo' },
  })

  if (!demo) {
    console.error('Tenant "demo" not found.')
    process.exit(1)
  }

  console.log(`✓ Found tenant: ${demo.name} (${demo.slug})\n`)

  // Get all published content types
  const contentTypes = await prisma.contentType.findMany({
    where: { isPublished: true },
  })

  console.log(`Found ${contentTypes.length} published content types\n`)

  let assignedCount = 0
  let skippedCount = 0

  for (const contentType of contentTypes) {
    console.log(`Processing: ${contentType.name} (${contentType.slug})`)

    // Check if assignment already exists
    const existingAssignment = await prisma.tenantContentTypeAssignment.findUnique({
      where: {
        tenantId_contentTypeId: {
          tenantId: demo.id,
          contentTypeId: contentType.id,
        },
      },
    })

    if (existingAssignment) {
      console.log(`  → Already assigned (enabled: ${existingAssignment.enabled})`)
      
      // Update to enabled if disabled
      if (!existingAssignment.enabled) {
        await prisma.tenantContentTypeAssignment.update({
          where: { id: existingAssignment.id },
          data: { enabled: true },
        })
        console.log(`  ✓ Updated to enabled`)
      } else {
        skippedCount++
      }
    } else {
      // Create assignment
      await prisma.tenantContentTypeAssignment.create({
        data: {
          tenantId: demo.id,
          contentTypeId: contentType.id,
          enabled: true,
        },
      })
      console.log(`  ✓ Created assignment`)
      assignedCount++
    }
    console.log('')
  }

  console.log('\n✅ Summary:')
  console.log(`  - New assignments: ${assignedCount}`)
  console.log(`  - Already assigned: ${skippedCount}`)
  console.log(`  - Total: ${assignedCount + skippedCount}`)
  console.log('\n✅ Done! Tenant "demo" now has access to all published content types')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })