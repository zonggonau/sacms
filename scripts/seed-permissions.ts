import { db } from "../src/lib/database.ts"
import { PERMISSIONS } from "../src/lib/rbac.ts"
import { TRANSITION_PERMISSIONS } from "../src/lib/content-workflow-rules.ts"

/**
 * Script to seed global permissions and default role-permission assignments.
 */

async function seed() {
  console.log("Seeding permissions...")

  const permissions = [
    ...Object.values(PERMISSIONS),
    ...Object.values(TRANSITION_PERMISSIONS),
  ]

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
  const workflow = TRANSITION_PERMISSIONS
  const roles = {
    admin: permissions,
    editor: [
      PERMISSIONS.CONTENT_READ,
      PERMISSIONS.CONTENT_CREATE,
      PERMISSIONS.CONTENT_UPDATE,
      PERMISSIONS.MEDIA_READ,
      PERMISSIONS.MEDIA_UPLOAD,
      workflow["DRAFT->IN_REVIEW"],
      workflow["ARCHIVED->DRAFT"],
      workflow["REJECTED->DRAFT"],
    ],
    member: [
      PERMISSIONS.CONTENT_READ,
      PERMISSIONS.CONTENT_CREATE,
      PERMISSIONS.CONTENT_UPDATE,
      workflow["DRAFT->IN_REVIEW"],
      workflow["REJECTED->DRAFT"],
    ],
    viewer: [
      PERMISSIONS.CONTENT_READ,
      PERMISSIONS.MEDIA_READ,
    ]
  }

  console.log("Seeding role-permission assignments...")

  for (const [roleName, rolePerms] of Object.entries(roles)) {
    for (const permName of rolePerms) {
      const perm = await db.permission.findUnique({ where: { name: permName } })
      if (!perm) continue

      const existing = await db.rolePermission.findFirst({
        where: { tenantId: null, roleId: roleName, permissionId: perm.id },
      })
      if (existing) {
        await db.rolePermission.update({
          where: { id: existing.id },
          data: { granted: true },
        })
      } else {
        await db.rolePermission.create({
          data: {
            tenantId: null,
            roleId: roleName,
            permissionId: perm.id,
            granted: true,
          },
        })
      }
    }
  }

  console.log("Successfully seeded RBAC defaults.")
}

seed()
  .catch(console.error)
  .finally(() => db.$disconnect())
