import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  console.log('Fixing all assignments for tenant "demo"...\n')

  const demo = await prisma.tenant.findUnique({ where: { slug: 'demo' } })
  if (!demo) {
    console.error('Tenant "demo" not found.')
    return
  }

  // 1. Assign ALL Content Types (Collection Types)
  const contentTypes = await prisma.contentType.findMany()
  console.log(`Found ${contentTypes.length} Content Types`)

  for (const ct of contentTypes) {
    await prisma.tenantContentTypeAssignment.upsert({
      where: {
        tenantId_contentTypeId: {
          tenantId: demo.id,
          contentTypeId: ct.id,
        },
      },
      update: { enabled: true },
      create: {
        tenantId: demo.id,
        contentTypeId: ct.id,
        enabled: true,
      },
    })
    console.log(`✓ Assigned Content Type: ${ct.name} (${ct.slug})`)
  }

  // 2. Assign ALL Single Types
  const singleTypes = await prisma.singleType.findMany()
  console.log(`\nFound ${singleTypes.length} Single Types`)

  for (const st of singleTypes) {
    await prisma.tenantSingleTypeAssignment.upsert({
      where: {
        tenantId_singleTypeId: {
          tenantId: demo.id,
          singleTypeId: st.id,
        },
      },
      update: { enabled: true },
      create: {
        tenantId: demo.id,
        singleTypeId: st.id,
        enabled: true,
      },
    })
    console.log(`✓ Assigned Single Type: ${st.name} (${st.slug})`)
  }

  console.log('\n✅ All assignments fixed for tenant "demo".')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
