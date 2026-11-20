import type { Prisma } from "@prisma/client"

type CatalogModel = "accountPlan" | "workspacePlan" | "addon" | "aiCreditPack"
type CatalogRow = { id: string; slug: string; price: number | null; yearlyPrice?: number | null; isActive: boolean; checkoutAlias?: string | null }

export async function isPricingRecordUsed(tx: Prisma.TransactionClient, model: CatalogModel, row: CatalogRow) {
  if (row.slug === "free" && (model === "accountPlan" || model === "workspacePlan")) return true
  if (model === "accountPlan" || model === "workspacePlan") {
    const scope: Prisma.SubscriptionWhereInput = model === "accountPlan"
      ? { tenantId: null, tenantSlugSnapshot: null }
      : { OR: [{ tenantId: { not: null } }, { tenantSlugSnapshot: { not: null } }] }
    const [assignment, subscription, checkout] = await Promise.all([
      model === "accountPlan"
        ? tx.user.findFirst({ where: { plan: row.slug }, select: { id: true } })
        : tx.tenant.findFirst({ where: { plan: row.slug }, select: { id: true } }),
      tx.subscription.findFirst({ where: { ...scope, plan: row.slug }, select: { id: true } }),
      tx.paymentTransaction.findFirst({
        where: { rawResponse: { path: ["intendedPlan"], equals: row.slug }, subscription: scope },
        select: { id: true },
      }),
    ])
    return !!(assignment || subscription || checkout)
  }

  const ids = row.checkoutAlias ? [row.id, row.slug, row.checkoutAlias] : [row.id, row.slug]
  const [purchase, subscription] = await Promise.all([
    tx.paymentTransaction.findFirst({
      where: { OR: ids.map(id => ({ rawResponse: { path: ["addonId"], equals: id } })) },
      select: { id: true },
    }),
    model === "addon"
      ? tx.subscription.findFirst({ where: { plan: { in: ids } }, select: { id: true } })
      : null,
  ])
  return !!(purchase || subscription)
}

export async function recordPricingChange(
  tx: Prisma.TransactionClient,
  userId: string,
  model: CatalogModel,
  action: "created" | "updated" | "deleted",
  row: CatalogRow,
  previous?: CatalogRow,
) {
  const snapshot = (record: CatalogRow) => ({
    slug: record.slug,
    price: record.price,
    yearlyPrice: record.yearlyPrice ?? null,
    isActive: record.isActive,
  })
  await tx.auditLog.create({
    data: {
      userId,
      action: "billing.pricing_" + action,
      entity: model,
      entityId: row.id,
      data: {
        current: action === "deleted" ? null : snapshot(row),
        previous: previous ? snapshot(previous) : action === "deleted" ? snapshot(row) : null,
      },
    },
  })
}
