import { NextRequest, NextResponse } from "next/server"
import { getPaymentProvider } from "@/lib/payment"
import { applyPaymentOutcome } from "@/lib/billing/payment-success"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const headers = Object.fromEntries(request.headers.entries())

    // Use the payment provider abstraction to verify the webhook
    const provider = getPaymentProvider()
    const verified = await provider.verifyWebhook({ headers, body })

    if (!verified.valid) {
      console.error("Invalid webhook signature for order:", verified.orderId)
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
    }

    const { orderId, status, paymentType, transactionId, transactionTime, fraudStatus } = verified

    const paymentSuccess = status === "success"
    const paymentFailed = status === "failed" || status === "cancelled" || status === "expired"

    if (!paymentSuccess && !paymentFailed) {
      // Still pending/unresolved on the provider's side — nothing to apply yet.
      return NextResponse.json({ success: true, message: "No terminal status yet" })
    }

    const result = await applyPaymentOutcome(orderId, paymentSuccess ? "success" : "failed", {
      rawProviderPayload: body,
      paymentType: paymentType || null,
      transactionId: transactionId || null,
      transactionTime: transactionTime || null,
      fraudStatus: fraudStatus || null,
    })

    if (!result.applied) {
      if (result.alreadyProcessed) {
        return NextResponse.json({ success: true, message: "Already processed" })
      }
      console.error("Transaction not found:", orderId)
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error processing webhook:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({
    message: "Payment webhook endpoint is active",
  })
}