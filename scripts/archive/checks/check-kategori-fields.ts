import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  console.log('Checking Kategori content type...\n')

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

  console.log(`Content Type: ${kategori.name} (${kategori.slug})`)
  console.log(`Total Fields: ${kategori.fields.length}`)
  console.log(`Published: ${kategori.isPublished}\n`)
  
  console.log('Fields:')
  kategori.fields.forEach((field, index) => {
    console.log(`${index + 1}. ${field.name} (${field.slug})`)
    console.log(`   Type: ${field.type}`)
    console.log(`   Required: ${field.required}`)
    console.log(`   Options: ${field.options || 'none'}`)
    console.log(`   jsonPath: ${field.jsonPath || 'none'}`)
    console.log('')
  })

  // Check tenant assignments
  console.log('\nChecking tenant assignments...\n')
  
  const assignments = await prisma.tenantContentTypeAssignment.findMany({
    where: {
      contentTypeId: kategori.id,
    },
    include: {
      tenant: true,
    },
  })

  console.log(`Total assignments: ${assignments.length}\n`)
  
  assignments.forEach((assignment, index) => {
    console.log(`${index + 1}. Tenant: ${assignment.tenant.name} (${assignment.tenant.slug})`)
    console.log(`   Enabled: ${assignment.enabled}`)
    console.log(`   Created: ${assignment.createdAt}`)
    console.log('')
  })

  // Check if demo tenant exists
  const demoTenant = await prisma.tenant.findUnique({
    where: { slug: 'demo' },
  })

  if (!demoTenant) {
    console.log('⚠️  Tenant "demo" not found!')
  } else {
    console.log(`✓ Tenant "demo" exists: ${demoTenant.name}`)
    
    // Check if demo has access to kategori
    const demoAssignment = assignments.find(a => a.tenantId === demoTenant.id)
    if (demoAssignment) {
      console.log(`✓ Demo has access to "kategori" (enabled: ${demoAssignment.enabled})`)
    } else {
      console.log('⚠️  Demo does NOT have access to "kategori"')
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