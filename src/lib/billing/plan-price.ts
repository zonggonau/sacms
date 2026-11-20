export function resolveYearlyPrice(monthlyPrice: number, yearlyPrice?: number | null): number {
  return yearlyPrice ?? monthlyPrice * 10
}

export type BillingInterval = "month" | "year"

type RecurringTerms = {
  billingInterval?: string | null
  recurringAmount?: number | null
  currentPeriodStart: Date | string | null
  currentPeriodEnd: Date | string | null
}

export function resolveBillingInterval(terms: RecurringTerms): BillingInterval {
  if (terms.billingInterval === "year" || terms.billingInterval === "month") return terms.billingInterval
  const start = terms.currentPeriodStart && new Date(terms.currentPeriodStart).getTime()
  const end = terms.currentPeriodEnd && new Date(terms.currentPeriodEnd).getTime()
  return typeof start === "number" && typeof end === "number" && end - start >= 300 * 86_400_000 ? "year" : "month"
}

export function resolveRecurringCharge(terms: RecurringTerms, prices: { monthly: number; yearly?: number | null }) {
  const interval = resolveBillingInterval(terms)
  const amount = terms.recurringAmount ?? (interval === "year" ? resolveYearlyPrice(prices.monthly, prices.yearly) : prices.monthly)
  return { interval, amount, monthlyAmount: interval === "year" ? amount / 12 : amount }
}

export function advanceBillingPeriod(start: Date, interval: BillingInterval): Date {
  const end = new Date(start)
  const day = end.getUTCDate()
  end.setUTCDate(1)
  end.setUTCMonth(end.getUTCMonth() + (interval === "year" ? 12 : 1))
  const lastDay = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() + 1, 0)).getUTCDate()
  end.setUTCDate(Math.min(day, lastDay))
  return end
}
