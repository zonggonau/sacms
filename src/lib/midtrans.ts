import Midtrans from 'midtrans-client'
import crypto from 'crypto'

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

// Initialize Midtrans Snap client
const midtransClient = new Midtrans.Snap({
  isProduction: process.env.MIDTRANS_MODE === 'production',
  serverKey: process.env.MIDTRANS_SERVER_KEY!,
  clientKey: process.env.MIDTRANS_CLIENT_KEY!,
})

/**
 * Create a Snap payment transaction
 */
export async function createSnapPayment(
  params: CreatePaymentParams
): Promise<SnapTransactionResponse> {
  try {
    const transaction = await midtransClient.createTransaction({
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
    const transaction = await midtransClient.transaction.status(orderId)
    return transaction
  } catch (error) {
    console.error('Error getting transaction status:', error)
    throw new Error('Failed to get transaction status')
  }
}

/**
 * Cancel a pending transaction
 */
export async function cancelTransaction(orderId: string) {
  try {
    await midtransClient.transaction.cancel(orderId)
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
    await midtransClient.transaction.refund(orderId)
    return true
  } catch (error) {
    console.error('Error refunding transaction:', error)
    throw new Error('Failed to refund transaction')
  }
}

/**
 * Plan pricing configuration
 */
export const PLAN_PRICES: Record<string, number> = {
  free: 0,
  starter: 9000,      // Rp 9.000
  pro: 29000,          // Rp 29.000
  enterprise: 199000,   // Rp 199.000
} as const

export type PlanType = keyof typeof PLAN_PRICES

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
export function calculateProratedAmount(
  currentPlan: PlanType,
  newPlan: PlanType,
  currentPeriodStart: Date | string | null,
  currentPeriodEnd: Date | string | null
): {
  fullPrice: number
  proratedPrice: number
  daysRemaining: number
  totalDays: number
  percentageUsed: number
  credit: number
  amountDue: number
} {
  const currentPlanPrice = PLAN_PRICES[currentPlan] || 0
  const newPlanPrice = PLAN_PRICES[newPlan] || 0

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
  }
}