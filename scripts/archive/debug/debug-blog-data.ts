import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  const tenantSlug = 'demo'
  const contentTypeSlug = 'blog'

  const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug } })
  const contentType = await prisma.contentType.findUnique({ where: { slug: contentTypeSlug } })

  if (!tenant) {
    console.error(`Tenant "${tenantSlug}" not found.`)
    return
  }
  if (!contentType) {
    console.error(`Content Type "${contentTypeSlug}" not found.`)
    return
  }

  console.log(`Tenant ID: ${tenant.id}`)
  console.log(`Content Type ID: ${contentType.id}\n`)

  const total = await prisma.contentEntry.count({
    where: { tenantId: tenant.id, contentTypeId: contentType.id }
  })

  const published = await prisma.contentEntry.count({
    where: { tenantId: tenant.id, contentTypeId: contentType.id, status: 'PUBLISHED' }
  })

  console.log(`Total entries: ${total}`)
  console.log(`Published entries: ${published}\n`)

  const entries = await prisma.contentEntry.findMany({
    where: { tenantId: tenant.id, contentTypeId: contentType.id },
    select: { id: true, status: true, data: true, publishedAt: true }
  })

  console.log('--- Entries Detail ---')
  entries.forEach((e, i) => {
    console.log(`${i+1}. ID: ${e.id}`)
    console.log(`   Status: ${e.status}`)
    console.log(`   Published At: ${e.publishedAt}`)
    console.log(`   Data: ${typeof e.data === 'string' ? e.data.substring(0, 100) : JSON.stringify(e.data).substring(0, 100)}...`)
    console.log('')
  })
}

main().finally(() => prisma.$disconnect())
