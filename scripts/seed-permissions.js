const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const PERMISSIONS = {
  CONTENT_READ: "content.read",
  CONTENT_CREATE: "content.create",
  CONTENT_UPDATE: "content.update",
  CONTENT_DELETE: "content.delete",
  MEDIA_READ: "media.read",
  MEDIA_UPLOAD: "media.upload",
  MEDIA_DELETE: "media.delete",
  USER_INVITE: "user.invite",
  USER_REMOVE: "user.remove",
  SETTING_UPDATE: "settings.update",
  API_TOKEN_MANAGE: "api-token.manage",
};

async function seed() {
  console.log("Seeding permissions...");

  const permissions = Object.values(PERMISSIONS);

  for (const name of permissions) {
    const displayName = name.split(".").map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(" ");
    await prisma.permission.upsert({
      where: { name },
      update: { displayName },
      create: { 
        name, 
        displayName,
        category: name.split(".")[0] || "other"
      }
    });
  }

  console.log(`Seeded ${permissions.length} permissions.`);

  const roles = {
    admin: Object.values(PERMISSIONS),
    editor: [
      PERMISSIONS.CONTENT_READ,
      PERMISSIONS.CONTENT_CREATE,
      PERMISSIONS.CONTENT_UPDATE,
      PERMISSIONS.MEDIA_READ,
      PERMISSIONS.MEDIA_UPLOAD,
    ],
    viewer: [
      PERMISSIONS.CONTENT_READ,
      PERMISSIONS.MEDIA_READ,
    ]
  };

  console.log("Seeding role-permission assignments...");

  for (const [roleName, rolePerms] of Object.entries(roles)) {
    // Ensure Role exists in global context (tenantId: null)
    const existingRole = await prisma.role.findFirst({
      where: { tenantId: null, name: roleName }
    });

    if (!existingRole) {
      await prisma.role.create({
        data: {
          tenantId: null,
          name: roleName,
          displayName: roleName.charAt(0).toUpperCase() + roleName.slice(1),
          isSystem: true
        }
      });
    }

    for (const permName of rolePerms) {
      const perm = await prisma.permission.findUnique({ where: { name: permName } });
      if (!perm) continue;

      const existingRP = await prisma.rolePermission.findFirst({
        where: { tenantId: null, roleId: roleName, permissionId: perm.id }
      });

      if (existingRP) {
        await prisma.rolePermission.update({
          where: { id: existingRP.id },
          data: { granted: true }
        });
      } else {
        await prisma.rolePermission.create({
          data: {
            tenantId: null,
            roleId: roleName,
            permissionId: perm.id,
            granted: true
          }
        });
      }
    }
  }

  console.log("Successfully seeded RBAC defaults.");
}

seed()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
