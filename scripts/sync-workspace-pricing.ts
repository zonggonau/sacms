import { PrismaClient } from "../prisma/generated-client"
const prisma = new PrismaClient()

async function main() {
  const ct = await prisma.contentType.findFirst({
    where: { slug: "sacms-workspace-pricing" }
  })
  if (!ct) {
    console.error("sacms-workspace-pricing content type not found")
    return
  }

  const entries = await prisma.contentEntry.findMany({
    where: { contentTypeId: ct.id }
  })

  console.log(`Found ${entries.length} workspace pricing entries to update.`)

  const updatedPricingMap: Record<string, { price: number; yearly_price: number }> = {
    free: { price: 0, yearly_price: 0 },
    starter: { price: 99000, yearly_price: 990000 },
    pro: { price: 299000, yearly_price: 2990000 },
    enterprise: { price: 999000, yearly_price: 9990000 }
  }

  for (const entry of entries) {
    const data = (typeof entry.data === "string" ? JSON.parse(entry.data) : entry.data) as any
    const slug = data.plan_slug || ""
    if (updatedPricingMap[slug]) {
      const updatedData = {
        ...data,
        price: updatedPricingMap[slug].price,
        yearly_price: updatedPricingMap[slug].yearly_price
      }
      await prisma.contentEntry.update({
        where: { id: entry.id },
        data: { data: updatedData }
      })
      console.log(`Updated ${slug}: price = ${updatedData.price}, yearly = ${updatedData.yearly_price}`)
    }
  }

  // Also check sacms-account-pricing to ensure consistency
  const act = await prisma.contentType.findFirst({
    where: { slug: "sacms-account-pricing" }
  })
  if (act) {
    const aEntries = await prisma.contentEntry.findMany({
      where: { contentTypeId: act.id }
    })
    for (const aEntry of aEntries) {
      const data = (typeof aEntry.data === "string" ? JSON.parse(aEntry.data) : aEntry.data) as any
      const slug = data.plan_slug || ""
      if (updatedPricingMap[slug]) {
        const updatedData = {
          ...data,
          price: updatedPricingMap[slug].price,
          yearly_price: updatedPricingMap[slug].yearly_price
        }
        await prisma.contentEntry.update({
          where: { id: aEntry.id },
          data: { data: updatedData }
        })
        console.log(`Updated account ${slug}: price = ${updatedData.price}, yearly = ${updatedData.yearly_price}`)
      }
    }
  }
}

main().finally(() => prisma.$disconnect())
