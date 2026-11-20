import { db } from "@/lib/database"
import { resolveRecurringCharge } from "./plan-price"

type Terms = Parameters<typeof resolveRecurringCharge>[0] & { id: string; plan: string }

/** Read the latest applicable checkout for subscriptions that predate term snapshots. */
export async function loadLegacyBillingTerms(subscriptions: Terms[]) {
  const legacy = new Map(subscriptions
    .filter(subscription => !subscription.billingInterval || subscription.recurringAmount == null)
    .map(subscription => [subscription.id, subscription]))
  const terms = new Map<string, { billingInterval: "year" | "month"; recurringAmount?: number }>()
  if (!legacy.size) return terms

  const payments = await db.paymentTransaction.findMany({
    where: {
      AND: [
        { OR: [{ fulfillmentStatus: null }, { fulfillmentStatus: "completed" }] },
        { OR: [{ orderId: { startsWith: "SUB-" } }, { orderId: { startsWith: "ACC-" } }] },
      ],
      subscriptionId: { in: [...legacy.keys()] },
      status: "success",
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: { subscriptionId: true, rawResponse: true },
  })
  for (const { subscriptionId, rawResponse } of payments) {
    if (!subscriptionId || terms.has(subscriptionId) ||
      !rawResponse || typeof rawResponse !== "object" || Array.isArray(rawResponse)) continue
    const { intendedPlan, intendedInterval, intendedRecurringAmount } = rawResponse
    if (intendedPlan !== legacy.get(subscriptionId)?.plan || (intendedInterval !== "month" && intendedInterval !== "year")) continue
    terms.set(subscriptionId, {
      billingInterval: intendedInterval,
      ...(typeof intendedRecurringAmount === "number" && Number.isFinite(intendedRecurringAmount) && intendedRecurringAmount >= 0
        ? { recurringAmount: intendedRecurringAmount }
        : {}),
    })
  }
  return terms
}

export function resolveSubscriptionTerms(
  subscription: Terms,
  prices: Parameters<typeof resolveRecurringCharge>[1],
  checkoutTerms: Awaited<ReturnType<typeof loadLegacyBillingTerms>>,
) {
  const checkout = checkoutTerms.get(subscription.id)
  return resolveRecurringCharge({
    ...subscription,
    billingInterval: subscription.billingInterval ?? checkout?.billingInterval,
    recurringAmount: subscription.recurringAmount ?? checkout?.recurringAmount,
  }, prices)
}
