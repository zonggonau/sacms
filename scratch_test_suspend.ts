import { db } from "./src/lib/database"

async function testSuspendTenants() {
  const expiredThreshold = new Date()
  expiredThreshold.setDate(expiredThreshold.getDate() - 30)
  
  console.log("Checking tenants expired before:", expiredThreshold)

  const activeTenants = await db.tenant.findMany({
    where: {
      status: "active"
    },
    include: {
      subscriptions: {
        orderBy: { currentPeriodEnd: "desc" },
        take: 1
      }
    }
  })

  let suspendedCount = 0

  for (const tenant of activeTenants) {
    const latestSub = tenant.subscriptions[0]
    if (latestSub && latestSub.currentPeriodEnd) {
      console.log(`Tenant ${tenant.slug} latest sub end: ${latestSub.currentPeriodEnd}`)
      if (latestSub.currentPeriodEnd < expiredThreshold) {
        console.log(`Tenant ${tenant.slug} should be suspended!`)
        suspendedCount++
      }
    } else {
      console.log(`Tenant ${tenant.slug} has no active expiring subscriptions.`)
    }
  }

  console.log("Total tenants that would be suspended:", suspendedCount)
}

testSuspendTenants()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
