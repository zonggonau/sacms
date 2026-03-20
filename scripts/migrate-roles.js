const { PrismaClient } = require('@prisma/client');
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

  console.log(`Found ${rps.length} unique roles to create.`);

  for (const rp of rps) {
    const displayName = rp.roleId.charAt(0).toUpperCase() + rp.roleId.slice(1);
    
    // Prisma handles null in where slightly differently for compound unique
    const where = rp.tenantId 
      ? { tenantId_name: { tenantId: rp.tenantId, name: rp.roleId } }
      : { id: (await prisma.role.findFirst({ where: { tenantId: null, name: rp.roleId } }))?.id || 'new' };

    await prisma.role.upsert({
      where,
      update: {},
      create: {
        tenantId: rp.tenantId,
        name: rp.roleId,
        displayName: displayName,
        isSystem: ['owner', 'admin', 'editor', 'viewer'].includes(rp.roleId)
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
