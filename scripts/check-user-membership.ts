import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  console.log('Checking user membership...\n')

  // Get all users
  const users = await prisma.user.findMany()
  console.log(`Total users: ${users.length}\n`)

  // Find kominfo tenant
  const kominfo = await prisma.tenant.findUnique({
    where: { slug: 'kominfo' },
  })

  if (!kominfo) {
    console.error('Tenant "kominfo" not found.')
    process.exit(1)
  }

  console.log(`Tenant: ${kominfo.name} (${kominfo.slug})`)
  console.log(`Tenant ID: ${kominfo.id}\n`)

  // Check memberships for kominfo
  const memberships = await prisma.tenantMember.findMany({
    where: { tenantId: kominfo.id },
    include: {
      user: true,
    },
  })

  console.log(`Total memberships for kominfo: ${memberships.length}\n`)

  if (memberships.length === 0) {
    console.log('⚠️  NO MEMBERSHIPS FOUND FOR KOMINFO!')
    console.log('\nCreating admin user membership...')

    // Find or create an admin user
    let adminUser = await prisma.user.findFirst({
      where: { role: 'super_admin' },
    })

    if (!adminUser) {
      // Create a super admin user
      adminUser = await prisma.user.create({
        data: {
          name: 'Super Admin',
          email: 'admin@sacms.com',
          role: 'super_admin',
        },
      })
      console.log(`✓ Created super admin user: ${adminUser.email}`)
    } else {
      console.log(`✓ Found super admin user: ${adminUser.email}`)
    }

    // Create membership for kominfo
    await prisma.tenantMember.create({
      data: {
        tenantId: kominfo.id,
        userId: adminUser.id,
        role: 'admin',
      },
    })

    console.log('✓ Created membership for kominfo')
  } else {
    memberships.forEach((m, index) => {
      console.log(`${index + 1}. ${m.user.name} (${m.user.email})`)
      console.log(`   Role: ${m.role}`)
      console.log(`   User Role: ${m.user.role}`)
      console.log('')
    })
  }

  // Check all tenants and their memberships
  console.log('\n\nAll tenants and memberships:\n')
  
  const tenants = await prisma.tenant.findMany()
  
  for (const t of tenants) {
    const tMemberships = await prisma.tenantMember.findMany({
      where: { tenantId: t.id },
      include: { user: true },
    })
    
    console.log(`${t.name} (${t.slug})`)
    console.log(`  Members: ${tMemberships.length}`)
    tMemberships.forEach(m => {
      console.log(`    - ${m.user.email} (${m.role})`)
    })
    console.log('')
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