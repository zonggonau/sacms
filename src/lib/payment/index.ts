import { registerPaymentProvider, getPaymentProvider, getAvailableProviders } from "./provider"
import { MidtransProvider } from "./midtrans"

export type { PaymentProvider, CreatePaymentRequest, CreatePaymentResult, VerifyWebhookRequest, VerifyWebhookResult, TransactionStatusResult } from "./provider"
export { getPaymentProvider, getAvailableProviders }

// ==================== AUTO-REGISTER PROVIDERS ====================

// Register Midtrans if configured
if (process.env.MIDTRANS_SERVER_KEY) {
  registerPaymentProvider(new MidtransProvider())
}
