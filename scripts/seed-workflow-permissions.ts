import { PrismaClient } from "@prisma/client"

const db = new PrismaClient()

const workflowPermissions = [
  { name: "workflow.draft_to_review", displayName: "Submit for Review", description: "Allow users to move Drafts into Review.", category: "workflow" },
  { name: "workflow.review_to_approve", displayName: "Approve Content", description: "Allow users to Approve content that is In Review.", category: "workflow" },
  { name: "workflow.review_to_reject", displayName: "Reject Content", description: "Allow users to Reject content that is In Review.", category: "workflow" },
  { name: "workflow.approve_to_schedule", displayName: "Schedule Content", description: "Allow users to Schedule approved content.", category: "workflow" },
  { name: "workflow.approve_to_publish", displayName: "Publish Content", description: "Allow users to Publish approved content immediately.", category: "workflow" },
  { name: "workflow.publish_to_archive", displayName: "Archive Content", description: "Allow users to Archive published content.", category: "workflow" },
  { name: "workflow.archive_to_draft", displayName: "Restore to Draft", description: "Allow users to restore Archived content to Draft.", category: "workflow" },
]

async function main() {
  console.log("Seeding Workflow Permissions...")
  for (const perm of workflowPermissions) {
    await db.permission.upsert({
      where: { name: perm.name },
      update: {
        displayName: perm.displayName,
        description: perm.description,
        category: perm.category,
      },
      create: {
        name: perm.name,
        displayName: perm.displayName,
        description: perm.description,
        category: perm.category,
      },
    })
    console.log(`Upserted permission: ${perm.name}`)
  }
  console.log("Seeding complete.")
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect())
