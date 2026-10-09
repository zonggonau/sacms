import { db } from "@/lib/database"
import crypto from "crypto"

async function main() {
  console.log("Checking and backfilling ownerSlug for existing users...")
  const users = await db.user.findMany({
    where: { ownerSlug: null },
  })

  console.log(`Found ${users.length} users without ownerSlug.`)
  for (const u of users) {
    const isSuperAdmin = u.role === "super_admin"
    const slug = isSuperAdmin ? "admin" : "u" + crypto.randomBytes(7).toString("hex")
    await db.user.update({
      where: { id: u.id },
      data: {
        ownerSlug: slug,
        role: u.role === "user" ? "owner" : u.role,
      },
    })
    console.log(`Updated user ${u.email} -> ownerSlug: ${slug}, role: ${u.role === "user" ? "owner" : u.role}`)
  }

  console.log("Checking and associating workspace ownerId...")
  const tenants = await db.tenant.findMany({
    where: { ownerId: null },
    include: {
      members: {
        where: { role: "owner" },
        take: 1,
      },
    },
  })

  for (const t of tenants) {
    const ownerMember = t.members[0]
    if (ownerMember) {
      await db.tenant.update({
        where: { id: t.id },
        data: { ownerId: ownerMember.userId },
      })
      console.log(`Associated workspace ${t.slug} -> ownerId: ${ownerMember.userId}`)
    }
  }

  console.log("Backfill completed successfully.")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
