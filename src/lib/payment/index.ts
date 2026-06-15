import { registerPaymentProvider, getPaymentProvider, getAvailableProviders } from "./provider"
import { MidtransProvider } from "./midtrans"
import { StripeProvider } from "./stripe"
import { XenditProvider } from "./xendit"

export type { PaymentProvider, CreatePaymentRequest, CreatePaymentResult, VerifyWebhookRequest, VerifyWebhookResult, TransactionStatusResult } from "./provider"
export { getPaymentProvider, getAvailableProviders }

// ==================== AUTO-REGISTER PROVIDERS ====================

// Register Midtrans if configured
if (process.env.MIDTRANS_SERVER_KEY) {
  registerPaymentProvider(new MidtransProvider())
}

// Future: Register Stripe
if (process.env.STRIPE_SECRET_KEY || process.env.NODE_ENV !== "production") {
  registerPaymentProvider(StripeProvider)
}

// Future: Register Xendit
if (process.env.XENDIT_SECRET_KEY || process.env.NODE_ENV !== "production") {
  registerPaymentProvider(XenditProvider)
}
