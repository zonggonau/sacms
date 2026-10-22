import Midtrans from 'midtrans-client'
import crypto from 'crypto'
import { isMockAllowed, requireCredentialOutsideMock } from './dev-mode'

interface CustomerDetails {
  email: string
  firstName: string
  lastName?: string
  phone?: string
}

interface ItemDetails {
  id: string
  name: string
  price: number
  quantity: number
}

interface CreatePaymentParams {
  orderId: string
  amount: number
  customerDetails: CustomerDetails
  items: ItemDetails[]
}

interface SnapTransactionResponse {
  token: string
  redirect_url: string
}

// Lazy dynamic Midtrans Snap client
async function getMidtransClient(): Promise<any> {
  const { getResolvedMidtransConfig } = await import('./settings')
  const config = await getResolvedMidtransConfig()
  return new Midtrans.Snap({
    isProduction: config.isProduction,
    serverKey: config.serverKey || process.env.MIDTRANS_SERVER_KEY || '',
    clientKey: config.clientKey || process.env.MIDTRANS_CLIENT_KEY || '',
  })
}

/**
 * Create a Snap payment transaction
 */
export async function createSnapPayment(
  params: CreatePaymentParams
): Promise<SnapTransactionResponse> {
  // This legacy helper bypasses the lib/payment abstraction (and its
  // registered MockPaymentProvider) entirely, so it needs its own dev/test
  // fallback — without one, every caller (e.g. domain checkout) would throw
  // on any environment lacking a real MIDTRANS_SERVER_KEY, including local
  // dev/test. Mirrors the same NODE_ENV-gated rule as lib/payment/index.ts.
  const hasMidtransCredential = Boolean(process.env.MIDTRANS_SERVER_KEY?.trim())
  if (!hasMidtransCredential) {
    if (!isMockAllowed('midtrans', hasMidtransCredential)) {
      requireCredentialOutsideMock('midtrans', 'MIDTRANS_SERVER_KEY')
    }
    console.warn('[midtrans] MIDTRANS_SERVER_KEY not set — simulating Snap payment creation (dev/test only).')
    return {
      token: `mock_token_${params.orderId}`,
      redirect_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard/payment/mock?orderId=${encodeURIComponent(params.orderId)}`,
    }
  }

  try {
    const client = await getMidtransClient()
    const transaction = await client.createTransaction({
      transaction_details: {
        order_id: params.orderId,
        gross_amount: params.amount,
      },
      customer_details: {
        email: params.customerDetails.email,
        first_name: params.customerDetails.firstName,
        last_name: params.customerDetails.lastName || '',
        phone: params.customerDetails.phone,
      },
      item_details: params.items.map(item => ({
        id: item.id,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
      })),
      enabled_payments: [
        'credit_card',
        'gopay',
        'shopeepay',
        'bca_va',
        'mandiri_bill',
        'bri_va',
        'permata_va',
        'bni_va',
        'qris',
        'cimb_clicks',
        'danamon_online',
      ],
      callbacks: {
        finish: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/payment/success`,
        error: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/payment/failed`,
        pending: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/payment/pending`,
      },
    })

    return {
      token: transaction.token,
      redirect_url: transaction.redirect_url,
    }
  } catch (error) {
    console.error('Error creating Snap payment:', error)
    throw new Error('Failed to create payment transaction')
  }
}

/**
 * Verify Midtrans notification signature
 * Prevents fraudulent webhook calls
 */
export function verifyNotificationSignature(
  orderId: string,
  statusCode: string,
  grossAmount: string,
  signatureKey: string
): boolean {
  try {
    const serverKey = process.env.MIDTRANS_SERVER_KEY!
    
    // Create SHA512 signature
    const signature = crypto
      .createHash('sha512')
      .update(orderId + statusCode + grossAmount + serverKey)
      .digest('hex')
    
    return signature === signatureKey
  } catch (error) {
    console.error('Error verifying signature:', error)
    return false
  }
}

/**
 * Get transaction status from Midtrans
 */
export async function getTransactionStatus(orderId: string) {
  try {
    const client = await getMidtransClient()
    const transaction = await client.transaction.status(orderId)
    return transaction
  } catch (error: any) {
    if (
      error?.httpStatusCode === '404' || 
      error?.ApiResponse?.status_code === '404' || 
      error?.message?.includes("doesn't exist") || 
      error?.message?.includes('404')
    ) {
      return {
        transaction_status: 'pending',
        status_code: '201',
        status_message: 'Transaction is pending or not yet completed by customer.'
      }
    }
    console.error('Error getting transaction status:', error)
    throw new Error('Failed to get transaction status')
  }
}

/**
 * Cancel a pending transaction
 */
export async function cancelTransaction(orderId: string) {
  try {
    const client = await getMidtransClient()
    await client.transaction.cancel(orderId)
    return true
  } catch (error) {
    console.error('Error canceling transaction:', error)
    throw new Error('Failed to cancel transaction')
  }
}

/**
 * Refund a transaction
 */
export async function refundTransaction(orderId: string) {
  try {
    const client = await getMidtransClient()
    await client.transaction.refund(orderId)
    return true
  } catch (error) {
    console.error('Error refunding transaction:', error)
    throw new Error('Failed to refund transaction')
  }
}

/**
 * Plan pricing configuration (Fallback)
 */
export const PLAN_PRICES: Record<string, number> = {
  free: 0,
  starter: 99000,
  pro: 299000,
  enterprise: 999000,
  standard: 149000, // Legacy fallback
  professional: 449000, // Legacy fallback
  business: 949000, // Legacy fallback
  unlimited: 1999000, // Legacy fallback
} as const

export type PlanType = string

/**
 * Fetch dynamic plan prices — from the dedicated AccountPlan/WorkspacePlan
 * tables (src/lib/pricing.ts), not CMS Content Entries anymore. Shape
 * (`Record<slug, {monthly, yearly}>`) is unchanged on purpose, so every
 * existing caller of these two functions keeps working without its own
 * changes. Falls back to the same hardcoded figures as before only if the
 * table is genuinely empty (shouldn't happen post-migration, but matches
 * the old "never return nothing" behavior rather than a new failure mode).
 */
export async function getDynamicAccountPrices(): Promise<Record<string, { monthly: number, yearly: number }>> {
  try {
    const { getAccountPlans } = await import("@/lib/pricing")
    const plans = await getAccountPlans()
    if (plans.length > 0) {
      const prices: Record<string, { monthly: number, yearly: number }> = {}
      for (const p of plans) prices[p.slug] = { monthly: p.price, yearly: p.yearlyPrice ?? 0 }
      return prices
    }
  } catch (e) {
    console.error("Error fetching dynamic account prices:", e)
  }

  const fallbackPrices: Record<string, { monthly: number, yearly: number }> = {
    free: { monthly: 0, yearly: 0 },
    starter: { monthly: 49000, yearly: 390000 },
    pro: { monthly: 129000, yearly: 990000 },
    enterprise: { monthly: 299000, yearly: 2490000 },
  }
  return fallbackPrices
}

export async function getDynamicWorkspacePrices(): Promise<Record<string, { monthly: number, yearly: number }>> {
  try {
    const { getWorkspacePlans } = await import("@/lib/pricing")
    const plans = await getWorkspacePlans()
    if (plans.length > 0) {
      const prices: Record<string, { monthly: number, yearly: number }> = {}
      for (const p of plans) prices[p.slug] = { monthly: p.price, yearly: p.yearlyPrice ?? 0 }
      return prices
    }
  } catch (e) {
    console.error("Error fetching dynamic workspace prices:", e)
  }

  const fallbackPrices: Record<string, { monthly: number, yearly: number }> = {
    free: { monthly: 0, yearly: 0 },
    pro: { monthly: 249000, yearly: 1490000 },
    enterprise: { monthly: 490000, yearly: 3900000 },
  }
  return fallbackPrices
}

/**
 * Resolve a subscription's real monthly price: the live, CMS-configured
 * price for its plan slug (looked up in the account-plan or workspace-plan
 * table, matching which one the subscription actually belongs to), falling
 * back to the static PLAN_PRICES map only when nothing dynamic is
 * configured for that slug. This is the one true price source actual
 * billing already used (generate-invoices) — now also reused by the admin
 * financial reports (financial-engine.ts) so the Executive P&L can no
 * longer drift from what tenants are actually charged.
 */
export function resolveSubscriptionMonthlyPrice(
  plan: string,
  isAccountPlan: boolean,
  dynamicWorkspacePrices: Record<string, { monthly: number; yearly: number }>,
  dynamicAccountPrices: Record<string, { monthly: number; yearly: number }>,
): number {
  const dynamicPrices = isAccountPlan ? dynamicAccountPrices : dynamicWorkspacePrices
  const rawPrice = dynamicPrices[plan] ?? PLAN_PRICES[plan] ?? 0
  return typeof rawPrice === "number" ? rawPrice : rawPrice.monthly
}

/**
 * Calculate period end date based on plan and interval
 */
export function calculatePeriodEndDate(plan: PlanType, interval: 'month' | 'year' = 'month'): Date {
  if (plan === 'free') return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  
  const days = interval === 'year' ? 365 : 30
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000)
}

/**
 * Calculate prorated amount for plan upgrade
 */
export async function calculateProratedAmount(
  currentPlan: PlanType,
  newPlan: PlanType,
  currentPeriodStart: Date | string | null,
  currentPeriodEnd: Date | string | null,
  isAccountPlan: boolean = false
): Promise<{
  fullPrice: number
  proratedPrice: number
  daysRemaining: number
  totalDays: number
  percentageUsed: number
  credit: number
  amountDue: number
  isDowngrade: boolean
}> {
  // Account (personal) and workspace (tenant) plans are priced from two
  // independently admin-edited CMS tables that can share slugs ("pro")
  // at different prices — pricing both off the workspace table regardless
  // of which product is being bought mismatches the credit against what
  // was actually paid, and can make isDowngrade wrong in either direction.
  const dynamicPrices = isAccountPlan ? await getDynamicAccountPrices() : await getDynamicWorkspacePrices()
  const currentPlanPrice = dynamicPrices[currentPlan]?.monthly || 0
  const newPlanPrice = dynamicPrices[newPlan]?.monthly || 0
  const isDowngrade = currentPlanPrice > newPlanPrice

  // If no active period, pay full price
  if (!currentPeriodStart || !currentPeriodEnd) {
    return {
      fullPrice: newPlanPrice,
      proratedPrice: newPlanPrice,
      daysRemaining: 0,
      totalDays: 0,
      percentageUsed: 0,
      credit: 0,
      amountDue: newPlanPrice,
      isDowngrade,
    }
  }

  const startDate = new Date(currentPeriodStart)
  const endDate = new Date(currentPeriodEnd)
  const now = new Date()

  // Calculate total days in current period
  const totalDays = Math.ceil(
    (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
  )

  // Calculate days remaining
  const daysRemaining = Math.max(
    0,
    Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  )

  // Calculate percentage used
  const percentageUsed = Math.min(
    1,
    Math.max(0, (now.getTime() - startDate.getTime()) / (endDate.getTime() - startDate.getTime()))
  )

  // Calculate credit from unused portion of current plan
  const credit = Math.round(currentPlanPrice * (1 - percentageUsed))

  // Calculate prorated new plan price for remaining days
  const proratedPrice = Math.round(newPlanPrice * (daysRemaining / totalDays))

  // Amount due: prorated new plan price minus credit
  const amountDue = Math.max(0, proratedPrice - credit)

  return {
    fullPrice: newPlanPrice,
    proratedPrice,
    daysRemaining,
    totalDays,
    percentageUsed,
    credit,
    amountDue,
    isDowngrade,
  }
}