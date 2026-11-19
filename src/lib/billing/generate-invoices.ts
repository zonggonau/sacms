import { db } from "@/lib/database"
import { getDynamicWorkspacePrices, getDynamicAccountPrices, resolveSubscriptionMonthlyPrice } from "@/lib/midtrans"

export async function generateMonthlyInvoices() {
  // Get all active subscriptions
  const activeSubscriptions = await db.subscription.findMany({
    where: {
      status: "active",
      NOT: {
        cancelAtPeriodEnd: true,
      },
    },
    include: {
      tenant: true,
      user: true,
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

  const dynamicWorkspacePrices = await getDynamicWorkspacePrices()
  const dynamicAccountPrices = await getDynamicAccountPrices()

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

      // Check if billing is overdue by more than 7 days
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

      const isAccountPlan = !subscription.tenantId
      const planPrice = resolveSubscriptionMonthlyPrice(subscription.plan, isAccountPlan, dynamicWorkspacePrices, dynamicAccountPrices)

      if (planPrice === 0) {
        // Free plan - extend period
        const newPeriodEnd = new Date(periodEnd)
        newPeriodEnd.setMonth(newPeriodEnd.getMonth() + 1)

        await db.subscription.updateMany({
          where: { id: subscription.id, status: "active", cancelAtPeriodEnd: false, currentPeriodEnd: periodEnd },
          data: {
            currentPeriodStart: periodEnd,
            currentPeriodEnd: newPeriodEnd,
          },
        })

        results.skipped++
        results.invoices.push({
          subscriptionId: subscription.id,
          tenantId: subscription.tenantId,
          amount: 0,
          status: "skipped",
          error: "Free plan - period extended",
        })
        continue
      }

      // Generate invoice
      const newPeriodStart = periodEnd
      const newPeriodEnd = new Date(periodEnd)
      newPeriodEnd.setMonth(newPeriodEnd.getMonth() + 1)

      // Both writes must land together — an invoice created without its
      // subscription's period advancing (or vice versa) would make the
      // next run either re-bill the same period under a second Invoice
      // row, or advance the period with nothing invoiced for it.
      const invoiced = await db.$transaction(async (tx) => {
        const claimed = await tx.subscription.updateMany({
          where: { id: subscription.id, status: "active", cancelAtPeriodEnd: false, currentPeriodEnd: periodEnd },
          data: { currentPeriodStart: newPeriodStart, currentPeriodEnd: newPeriodEnd },
        })
        if (claimed.count === 0) return false
        await tx.invoice.create({
          data: {
            subscriptionId: subscription.id,
            amount: planPrice,
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

      results.processed++
      results.invoices.push({
        subscriptionId: subscription.id,
        tenantId: subscription.tenantId,
        amount: planPrice,
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
