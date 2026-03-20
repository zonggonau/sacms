import Midtrans from "midtrans-client"
import { createHash } from "crypto"
import type {
  PaymentProvider,
  CreatePaymentRequest,
  CreatePaymentResult,
  VerifyWebhookRequest,
  VerifyWebhookResult,
  TransactionStatusResult,
} from "./provider.ts"

function mapMidtransStatus(
  transactionStatus: string
): VerifyWebhookResult["status"] {
  if (transactionStatus === "capture" || transactionStatus === "settlement") {
    return "success"
  }
  if (transactionStatus === "deny" || transactionStatus === "cancel") {
    return "cancelled"
  }
  if (transactionStatus === "expire") {
    return "expired"
  }
  return "pending"
}

export class MidtransProvider implements PaymentProvider {
  readonly name = "midtrans"
  private _snap: InstanceType<typeof Midtrans.Snap> | null = null

  private get snap() {
    if (!this._snap) {
      this._snap = new Midtrans.Snap({
        isProduction: process.env.MIDTRANS_MODE === "production",
        serverKey: process.env.MIDTRANS_SERVER_KEY!,
        clientKey: process.env.MIDTRANS_CLIENT_KEY!,
      })
    }
    return this._snap
  }

  async createPayment(req: CreatePaymentRequest): Promise<CreatePaymentResult> {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"

    const transaction = await this.snap.createTransaction({
      transaction_details: {
        order_id: req.orderId,
        gross_amount: req.amount,
      },
      customer_details: {
        email: req.customer.email,
        first_name: req.customer.firstName,
        last_name: req.customer.lastName || "",
        phone: req.customer.phone,
      },
      item_details: req.items.map((item) => ({
        id: item.id,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
      })),
      enabled_payments: [
        "credit_card",
        "gopay",
        "shopeepay",
        "bca_va",
        "mandiri_bill",
        "bri_va",
        "permata_va",
        "bni_va",
        "qris",
        "cimb_clicks",
        "danamon_online",
      ],
      callbacks: {
        finish: req.returnUrl || `${appUrl}/dashboard/payment/success`,
        error: req.cancelUrl || `${appUrl}/dashboard/payment/failed`,
        pending: `${appUrl}/dashboard/payment/pending`,
      },
    })

    return {
      token: transaction.token,
      redirectUrl: transaction.redirect_url,
      raw: transaction,
    }
  }

  async verifyWebhook(req: VerifyWebhookRequest): Promise<VerifyWebhookResult> {
    const body = req.body as Record<string, string>
    const {
      order_id,
      status_code,
      gross_amount,
      signature_key,
      transaction_status,
      payment_type,
      transaction_id,
      transaction_time,
      fraud_status,
    } = body

    // Verify signature
    const serverKey = process.env.MIDTRANS_SERVER_KEY!
    const expectedSignature = createHash("sha512")
      .update(order_id + status_code + gross_amount + serverKey)
      .digest("hex")

    const valid = expectedSignature === signature_key

    return {
      valid,
      orderId: order_id,
      status: mapMidtransStatus(transaction_status),
      paymentType: payment_type,
      transactionId: transaction_id,
      transactionTime: transaction_time
        ? new Date(transaction_time)
        : undefined,
      fraudStatus: fraud_status,
      raw: body,
    }
  }

  async getTransactionStatus(
    orderId: string
  ): Promise<TransactionStatusResult> {
    const result = await this.snap.transaction.status(orderId)
    return {
      orderId,
      status: mapMidtransStatus(result.transaction_status),
      paymentType: result.payment_type,
      transactionId: result.transaction_id,
      raw: result,
    }
  }

  async cancelTransaction(orderId: string): Promise<boolean> {
    try {
      await this.snap.transaction.cancel(orderId)
      return true
    } catch {
      return false
    }
  }

  async refundTransaction(orderId: string): Promise<boolean> {
    try {
      await this.snap.transaction.refund(orderId)
      return true
    } catch {
      return false
    }
  }
}
