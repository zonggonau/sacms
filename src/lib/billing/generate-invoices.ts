import { db } from "@/lib/database"
import { getDynamicWorkspacePrices, getDynamicAccountPrices, getSubscriptionCatalogPrice } from "@/lib/midtrans"
import { advanceBillingPeriod } from "./plan-price"
import { loadLegacyBillingTerms, resolveSubscriptionTerms } from "./subscription-terms"

export async function generateMonthlyInvoices() {
  // Get all active subscriptions
  const activeSubscriptions = await db.subscription.findMany({
    where: {
      status: "active",
      tenantSlugSnapshot: null,
      OR: [{ userId: { not: null } }, { tenantId: { not: null } }],
      NOT: {
        cancelAtPeriodEnd: true,
      },
    },
  })

  const results = {
    processed: 0,
    skipped: 0,
    failed: 0,
    invoices: [] as Array<{
      subscriptionId: string
      tenantId: string | null
      amount: number
      status: string
      error?: string
    }>,
  }

  // Get current date
  const now = new Date()

  const [dynamicWorkspacePrices, dynamicAccountPrices, checkoutTerms] = await Promise.all([
    getDynamicWorkspacePrices({ includeInactive: true }),
    getDynamicAccountPrices({ includeInactive: true }),
    loadLegacyBillingTerms(activeSubscriptions),
  ])

  for (const subscription of activeSubscriptions) {
    try {
      // Check if subscription needs billing
      if (!subscription.currentPeriodEnd) {
        results.skipped++
        results.invoices.push({
          subscriptionId: subscription.id,
          tenantId: subscription.tenantId,
          amount: 0,
          status: "skipped",
          error: "No billing period end date",
        })
        continue
      }

      const periodEnd = new Date(subscription.currentPeriodEnd)

      // Check if billing period has ended
      if (periodEnd > now) {
        results.skipped++
        results.invoices.push({
          subscriptionId: subscription.id,
          tenantId: subscription.tenantId,
          amount: 0,
          status: "skipped",
          error: "Billing period not yet ended",
        })
        continue
      }

      // Keep deeply overdue periods out of the automatic renewal cycle.
      const daysOverdue = Math.floor(
        (now.getTime() - periodEnd.getTime()) / (1000 * 60 * 60 * 24)
      )

      if (daysOverdue > 30) {
        results.skipped++
        results.invoices.push({
          subscriptionId: subscription.id,
          tenantId: subscription.tenantId,
          amount: 0,
          status: "skipped",
          error: "Billing overdue by more than 30 days",
        })
        continue
      }

      const catalog = getSubscriptionCatalogPrice(subscription.plan, !subscription.tenantId, dynamicWorkspacePrices, dynamicAccountPrices)
      const { interval, amount } = resolveSubscriptionTerms(subscription, catalog, checkoutTerms)
      const newPeriodEnd = advanceBillingPeriod(periodEnd, interval)

      // Both writes must land together — an invoice created without its
      // subscription's period advancing (or vice versa) would make the
      // next run either re-bill the same period under a second Invoice
      // row, or advance the period with nothing invoiced for it.
      const invoiced = await db.$transaction(async (tx) => {
        const claimed = await tx.subscription.updateMany({
          where: { id: subscription.id, status: "active", cancelAtPeriodEnd: false, currentPeriodEnd: periodEnd },
          data: {
            currentPeriodStart: periodEnd,
            currentPeriodEnd: newPeriodEnd,
            billingInterval: interval,
            ...(amount > 0 ? { recurringAmount: amount } : {}),
          },
        })
        if (claimed.count === 0) return false
        if (amount === 0) return true
        await tx.invoice.create({
          data: {
            subscriptionId: subscription.id,
            amount,
            currency: "IDR",
            status: "pending",
            createdAt: now,
          },
        })
        return true
      })
      if (!invoiced) {
        results.skipped++
        continue
      }
      if (amount === 0) {
        results.skipped++
        results.invoices.push({
          subscriptionId: subscription.id,
          tenantId: subscription.tenantId,
          amount: 0,
          status: "skipped",
          error: "Zero-priced period extended",
        })
        continue
      }

      results.processed++
      results.invoices.push({
        subscriptionId: subscription.id,
        tenantId: subscription.tenantId,
        amount,
        status: "created",
      })

      // TODO: Send invoice notification via email/webhook
    } catch (error) {
      console.error(
        `Error processing subscription ${subscription.id}:`,
        error
      )
      results.failed++
      results.invoices.push({
        subscriptionId: subscription.id,
        tenantId: subscription.tenantId,
        amount: 0,
        status: "failed",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  return {
    success: true,
    results,
    message: `Processed ${results.processed} subscriptions, skipped ${results.skipped}, failed ${results.failed}`,
  }
}
