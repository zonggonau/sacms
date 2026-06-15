import {
  PaymentProvider,
  CreatePaymentRequest,
  CreatePaymentResult,
  VerifyWebhookRequest,
  VerifyWebhookResult,
  TransactionStatusResult,
} from "./provider"

// We simulate Xendit integration here.
// In a real implementation, you would use the Xendit Node SDK:
// import { Xendit } from 'xendit-node';
// const xendit = new Xendit({ secretKey: process.env.XENDIT_SECRET_KEY });

export const XenditProvider: PaymentProvider = {
  name: "xendit",

  async createPayment(req: CreatePaymentRequest): Promise<CreatePaymentResult> {
    console.log("[Xendit] createPayment payload:", req)
    
    // Mock generating a Xendit Invoice ID
    const invoiceId = `inv_${Math.random().toString(36).substring(7)}`
    
    // A mock checkout URL. In production, this would be returned by xendit.Invoice.createInvoice()
    const redirectUrl = `https://checkout-staging.xendit.co/web/${invoiceId}`

    return {
      token: invoiceId,
      redirectUrl,
      raw: { id: invoiceId, invoice_url: redirectUrl },
    }
  },

  async verifyWebhook(req: VerifyWebhookRequest): Promise<VerifyWebhookResult> {
    // In production, verify the x-callback-token header against your Xendit webhook verification token
    console.log("[Xendit] verifyWebhook")
    const payload = req.body as any
    
    return {
      valid: true,
      orderId: payload?.external_id || "unknown",
      status: payload?.status === "PAID" ? "success" : "pending",
      paymentType: payload?.payment_method || "xendit_invoice",
      transactionId: payload?.id,
      transactionTime: payload?.paid_at ? new Date(payload.paid_at) : undefined,
      raw: payload,
    }
  },

  async getTransactionStatus(orderId: string): Promise<TransactionStatusResult> {
    console.log("[Xendit] getTransactionStatus for", orderId)
    // Normally fetch the invoice from Xendit and check its status
    return {
      orderId,
      status: "success",
      paymentType: "xendit_invoice",
      transactionId: `tx_${Math.random().toString(36).substring(7)}`,
      raw: { status: "PAID" },
    }
  },

  async cancelTransaction(orderId: string): Promise<boolean> {
    console.log("[Xendit] cancelTransaction for", orderId)
    // Xendit invoices can be expired via xendit.Invoice.expireInvoice()
    return true
  },

  async refundTransaction(orderId: string, amount?: number): Promise<boolean> {
    console.log(`[Xendit] refundTransaction for ${orderId}, amount: ${amount}`)
    // Refunds are generally supported depending on payment channel
    return true
  },
}
