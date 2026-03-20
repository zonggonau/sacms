import { db } from "../src/lib/database.ts"
import { PERMISSIONS } from "../src/lib/rbac.ts"

/**
 * Script to seed global permissions and default role-permission assignments.
 */

async function seed() {
  console.log("Seeding permissions...")

  const permissions = Object.values(PERMISSIONS)

  for (const name of permissions) {
    const displayName = name.split(".").map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(" ")
    await db.permission.upsert({
      where: { name },
      update: { displayName },
      create: { 
        name, 
        displayName,
        category: name.split(".")[0] || "other"
      }
    })
  }

  console.log(`Seeded ${permissions.length} permissions.`)

  // Default Assignments
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
  }

  console.log("Seeding role-permission assignments...")

  for (const [roleName, rolePerms] of Object.entries(roles)) {
    // Ensure Role exists in global context (tenantId: null)
    const existingRole = await db.role.findFirst({
      where: { tenantId: null, name: roleName }
    })

    if (!existingRole) {
      await db.role.create({
        data: {
          tenantId: null as any,
          name: roleName,
          displayName: roleName.charAt(0).toUpperCase() + roleName.slice(1),
          isSystem: true
        }
      })
    }

    for (const permName of rolePerms) {
      const perm = await db.permission.findUnique({ where: { name: permName } })
      if (!perm) continue

      await db.rolePermission.upsert({
        where: {
          tenantId_roleId_permissionId: {
            tenantId: null as any,
            roleId: roleName,
            permissionId: perm.id
          }
        },
        update: { granted: true },
        create: {
          tenantId: null as any,
          roleId: roleName,
          permissionId: perm.id,
          granted: true
        }
      })
    }
  }

  console.log("Successfully seeded RBAC defaults.")
}

seed()
  .catch(console.error)
  .finally(() => db.$disconnect())
