const { PrismaClient } = require('../prisma/generated-client');
const prisma = new PrismaClient();

async function main() {
  console.log('Migrating roles...');
  
  // Get all unique (tenantId, roleId) combinations from role_permissions
  const rps = await prisma.rolePermission.findMany({
    select: {
      tenantId: true,
      roleId: true
    },
    distinct: ['tenantId', 'roleId']
  });

  console.log(`Found ${rps.length} unique role identifiers.`);

  for (const rp of rps) {
    // Built-in/global roles are represented directly by RolePermission.roleId.
    // TenantRole stores only tenant-specific custom-role metadata.
    if (!rp.tenantId) {
      console.log(`Skipped global role identifier: ${rp.roleId}`);
      continue;
    }

    const displayName = rp.roleId
      .split(/[-_]/)
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');

    await prisma.tenantRole.upsert({
      where: {
        tenantId_slug: {
          tenantId: rp.tenantId,
          slug: rp.roleId,
        },
      },
      update: { name: displayName },
      create: {
        tenantId: rp.tenantId,
        slug: rp.roleId,
        name: displayName,
      }
    });
    console.log(`Created role: ${rp.roleId} for tenant: ${rp.tenantId || 'GLOBAL'}`);
  }
  
  console.log('Migration complete.');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
