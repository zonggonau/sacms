import { NextRequest, NextResponse } from "next/server"
import { getPaymentProvider } from "@/lib/payment"
import { db } from "@/lib/database"
import { triggerWebhooks } from "@/lib/webhooks"

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

    const transaction = await db.paymentTransaction.findUnique({
      where: { orderId },
      include: {
        subscription: {
          include: {
            tenant: true,
            user: true,
          },
        },
      },
    })

    if (!transaction) {
      console.error("Transaction not found:", orderId)
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 })
    }

    const paymentSuccess = status === "success"
    const paymentFailed = status === "failed" || status === "cancelled" || status === "expired"

    // Idempotency check: if already processed, return early to prevent duplicate invoices
    if ((transaction.status === "success" && paymentSuccess) || 
        (transaction.status === "failed" && paymentFailed)) {
      return NextResponse.json({ success: true, message: "Already processed" })
    }

    await db.paymentTransaction.update({
      where: { id: transaction.id },
      data: {
        status: paymentSuccess ? "success" : paymentFailed ? "failed" : "pending",
        paymentType: paymentType || null,
        transactionId: transactionId || null,
        transactionTime: transactionTime || null,
        fraudStatus: fraudStatus || null,
        rawResponse: body as any,
      },
    })

    if (paymentSuccess) {
      await db.subscription.update({
        where: { id: transaction.subscriptionId! },
        data: {
          status: "active",
          currentPeriodStart: new Date(),
        },
      })

      await db.invoice.create({
        data: {
          subscriptionId: transaction.subscriptionId!,
          amount: transaction.amount,
          currency: "IDR",
          status: "paid",
          paidAt: new Date(),
          midtransInvoiceId: transaction.orderId
        },
      })

      // Only update main plan if it's a regular subscription (orderId starts with SUB)
      // If it starts with ADD, it's an addon purchase
      // If it starts with ACC, it's an account upgrade
      if (orderId.startsWith("SUB")) {
        await db.tenant.update({
          where: { id: transaction.subscription!.tenantId! },
          data: { plan: transaction.subscription!.plan },
        })
      } else if (orderId.startsWith("ACC")) {
        await db.user.update({
          where: { id: transaction.subscription!.userId },
          data: { plan: transaction.subscription!.plan },
        })
      } else if (orderId.startsWith("ADD")) {
        // Logic for activating addon could go here
        // For now we just log it as a successful transaction
        console.log(`✅ Addon purchase successful for tenant ${transaction.subscription!.tenantId}: ${transaction.orderId}`)
      }

      if (transaction.subscription?.tenant) {
        await triggerWebhooks(
          transaction.subscription.tenantId,
          "payment.completed",
          {
            orderId,
            amount: transaction.amount,
            plan: transaction.subscription.plan,
          }
        )
      }
    }

    if (paymentFailed) {
      await db.subscription.update({
        where: { id: transaction.subscriptionId! },
        data: { status: "expired" },
      })

      await db.invoice.create({
        data: {
          subscriptionId: transaction.subscriptionId!,
          amount: transaction.amount,
          currency: "IDR",
          status: "failed",
        },
      })

      if (transaction.subscription?.tenant) {
        await triggerWebhooks(
          transaction.subscription.tenantId,
          "payment.failed",
          {
            orderId,
            amount: transaction.amount,
            reason: status,
          }
        )
      }
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