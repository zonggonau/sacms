/**
 * Payment Gateway Abstraction Layer
 *
 * Provides a unified interface for multiple payment providers.
 * Currently supports: Midtrans
 * Extensible to: Stripe, Xendit
 */

// ==================== INTERFACES ====================

export interface PaymentCustomer {
  email: string
  firstName: string
  lastName?: string
  phone?: string
}

export interface PaymentItem {
  id: string
  name: string
  price: number
  quantity: number
}

export interface CreatePaymentRequest {
  orderId: string
  amount: number
  currency?: string
  customer: PaymentCustomer
  items: PaymentItem[]
  metadata?: Record<string, string>
  returnUrl?: string
  cancelUrl?: string
}

export interface CreatePaymentResult {
  /** Provider-specific token or session ID */
  token: string
  /** URL to redirect user for payment */
  redirectUrl: string
  /** Raw provider response */
  raw?: unknown
}

export interface VerifyWebhookRequest {
  headers: Record<string, string>
  body: unknown
}

export interface VerifyWebhookResult {
  valid: boolean
  orderId: string
  status: "success" | "failed" | "pending" | "expired" | "cancelled"
  paymentType?: string
  transactionId?: string
  transactionTime?: Date
  fraudStatus?: string
  raw: unknown
}

export interface TransactionStatusResult {
  orderId: string
  status: "success" | "failed" | "pending" | "expired" | "cancelled"
  paymentType?: string
  transactionId?: string
  raw: unknown
}

export interface PaymentProvider {
  readonly name: string

  /** Create a payment session/transaction */
  createPayment(req: CreatePaymentRequest): Promise<CreatePaymentResult>

  /** Verify a webhook/notification from the provider */
  verifyWebhook(req: VerifyWebhookRequest): Promise<VerifyWebhookResult>

  /** Get the status of a transaction */
  getTransactionStatus(orderId: string): Promise<TransactionStatusResult>

  /** Cancel a pending transaction */
  cancelTransaction(orderId: string): Promise<boolean>

  /** Refund a transaction */
  refundTransaction(orderId: string, amount?: number): Promise<boolean>
}

// ==================== PROVIDER REGISTRY ====================

const providers = new Map<string, PaymentProvider>()

export function registerPaymentProvider(provider: PaymentProvider): void {
  providers.set(provider.name, provider)
}

export function getPaymentProvider(name?: string): PaymentProvider {
  const providerName = name || process.env.PAYMENT_PROVIDER || "midtrans"
  const provider = providers.get(providerName)
  if (!provider) {
    throw new Error(
      `Payment provider "${providerName}" not registered. Available: ${Array.from(providers.keys()).join(", ")}`
    )
  }
  return provider
}

export function getAvailableProviders(): string[] {
  return Array.from(providers.keys())
}
