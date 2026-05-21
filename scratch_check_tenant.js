const { PrismaClient } = require('./prisma/generated-client');
const prisma = new PrismaClient();

async function main() {
  const tenantIdOrSlug = "cmpe1fbyx0004ujowkjsbadze";
  console.log("Checking tenant ID or Slug:", tenantIdOrSlug);
  
  const tenantById = await prisma.tenant.findUnique({
    where: { id: tenantIdOrSlug },
    include: {
      members: {
        include: {
          user: true
        }
      }
    }
  });

  const tenantBySlug = await prisma.tenant.findUnique({
    where: { slug: tenantIdOrSlug },
    include: {
      members: {
        include: {
          user: true
        }
      }
    }
  });

  console.log("Tenant by ID:", JSON.stringify(tenantById, null, 2));
  console.log("Tenant by Slug:", JSON.stringify(tenantBySlug, null, 2));

  const allTenants = await prisma.tenant.findMany();
  console.log("All tenants in DB:", allTenants.map(t => ({ id: t.id, name: t.name, slug: t.slug })));
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
