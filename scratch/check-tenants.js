const { PrismaClient } = require("../prisma/generated-client");
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    include: {
      tenants: {
        include: {
          tenant: true
        }
      }
    }
  });
  console.log("USERS AND THEIR TENANTS:");
  console.log(JSON.stringify(users, null, 2));

  const allTenants = await prisma.tenant.findMany();
  console.log("\nALL TENANTS:");
  console.log(JSON.stringify(allTenants, null, 2));
}

main()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());
