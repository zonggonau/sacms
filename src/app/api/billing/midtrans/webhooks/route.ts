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
      } else if (orderId.startsWith("AIC")) {
        const raw = (transaction.rawResponse as any) || {}
        let creditsToAdd = Number(raw.credits || 0)
        const addonId = raw.addonId || ""

        if (!creditsToAdd) {
          const { AI_CREDIT_PACKS } = await import("@/lib/constants/tenant-limits")
          const pack = AI_CREDIT_PACKS.find(p => p.id === addonId)
          if (pack) creditsToAdd = pack.credits
        }

        if (creditsToAdd > 0 && transaction.subscription?.userId) {
          await db.user.update({
            where: { id: transaction.subscription.userId },
            data: { aiCreditsExtra: { increment: creditsToAdd } },
          })
          await db.aiQuotaLedger.create({
            data: {
              userId: transaction.subscription.userId,
              action: "topup_credits",
              credits: creditsToAdd,
              tokens: creditsToAdd * 1000,
              model: "topup_pack"
            }
          })
          console.log(`✅ AI Credit Top-Up applied successfully for user ${transaction.subscription.userId}: +${creditsToAdd} credits (${transaction.orderId})`)
        }
      } else if (orderId.startsWith("ADD")) {
        const tenantId = transaction.subscription?.tenantId
        if (tenantId) {
          const raw = (transaction.rawResponse as any) || {}
          const addonId = raw.addonId || ""

          // Check built-in top-up packs
          if (addonId === "topup_ai_500k") {
            await db.tenant.update({
              where: { id: tenantId },
              data: { aiCreditsExtra: { increment: 500000 } } as any
            })
          } else if (addonId === "topup_ai_2m") {
            await db.tenant.update({
              where: { id: tenantId },
              data: { aiCreditsExtra: { increment: 2000000 } } as any
            })
          } else if (addonId === "topup_storage_10gb") {
            await db.tenant.update({
              where: { id: tenantId },
              data: { storageExtraBytes: { increment: BigInt(10 * 1024 * 1024 * 1024) } } as any
            })
          } else if (addonId === "topup_api_500k") {
            await db.tenant.update({
              where: { id: tenantId },
              data: { apiCallsExtra: { increment: 500000 } } as any
            })
          }
          console.log(`✅ Addon top-up applied successfully for tenant ${tenantId}: ${addonId} (${transaction.orderId})`)
        }
      }

      if (transaction.subscription?.tenant) {
        await triggerWebhooks(
          transaction.subscription.tenantId!,
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
          transaction.subscription.tenantId!,
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