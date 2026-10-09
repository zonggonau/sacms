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
  WORKFLOW_DRAFT_TO_REVIEW: "workflow.draft_to_review",
  WORKFLOW_DRAFT_TO_PUBLISH: "workflow.draft_to_publish",
  WORKFLOW_DRAFT_TO_SCHEDULE: "workflow.draft_to_schedule",
  WORKFLOW_REVIEW_TO_APPROVE: "workflow.review_to_approve",
  WORKFLOW_REVIEW_TO_REJECT: "workflow.review_to_reject",
  WORKFLOW_APPROVE_TO_SCHEDULE: "workflow.approve_to_schedule",
  WORKFLOW_APPROVE_TO_PUBLISH: "workflow.approve_to_publish",
  WORKFLOW_SCHEDULED_TO_DRAFT: "workflow.scheduled_to_draft",
  WORKFLOW_PUBLISHED_TO_ARCHIVED: "workflow.published_to_archived",
  WORKFLOW_PUBLISHED_TO_DRAFT: "workflow.published_to_draft",
  WORKFLOW_ARCHIVED_TO_DRAFT: "workflow.archived_to_draft",
  WORKFLOW_REJECTED_TO_DRAFT: "workflow.rejected_to_draft",
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
      PERMISSIONS.WORKFLOW_DRAFT_TO_REVIEW,
      PERMISSIONS.WORKFLOW_ARCHIVED_TO_DRAFT,
      PERMISSIONS.WORKFLOW_REJECTED_TO_DRAFT,
    ],
    member: [
      PERMISSIONS.CONTENT_READ,
      PERMISSIONS.CONTENT_CREATE,
      PERMISSIONS.CONTENT_UPDATE,
      PERMISSIONS.WORKFLOW_DRAFT_TO_REVIEW,
      PERMISSIONS.WORKFLOW_REJECTED_TO_DRAFT,
    ],
    viewer: [
      PERMISSIONS.CONTENT_READ,
      PERMISSIONS.MEDIA_READ,
    ]
  };

  console.log("Seeding role-permission assignments...");

  for (const [roleName, rolePerms] of Object.entries(roles)) {
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
