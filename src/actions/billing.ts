"use server"

import { getDynamicAccountPrices } from "@/lib/midtrans"
import { db } from "@/lib/database"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export async function checkEnterpriseModeAction() {
  try {
    return false
  } catch (err) {
    return false
  }
}

export async function getAccountPricingAction(planId: string) {
  try {
    const dynamicPrices = await getDynamicAccountPrices()
    const prices = dynamicPrices[planId]
    
    if (prices) {
      return {
        id: planId,
        name: planId.charAt(0).toUpperCase() + planId.slice(1),
        priceAmount: prices.monthly,
        yearlyPrice: prices.yearly
      }
    }
    return null
  } catch (error) {
    console.error("Error fetching account pricing:", error)
    return null
  }
}

export async function getTransactionHistoryAction() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return []

    // Fetch subscriptions belonging to this user
    const subscriptions = await db.subscription.findMany({
      where: { userId: session.user.id },
      select: { id: true }
    })
    
    if (subscriptions.length === 0) return []

    const subIds = subscriptions.map(s => s.id)

    const transactions = await db.paymentTransaction.findMany({
      where: { subscriptionId: { in: subIds } },
      orderBy: { createdAt: 'desc' },
      take: 20
    })

    return transactions
  } catch (error) {
    console.error("Error fetching transactions:", error)
    return []
  }
}

import { getPaymentProvider } from "@/lib/payment"

export async function checkTransactionStatusAction(orderId: string) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return { success: false, error: "Unauthorized" }

    const transaction = await db.paymentTransaction.findUnique({
      where: { orderId },
      include: { subscription: true }
    })

    if (!transaction || transaction.subscription?.userId !== session.user.id) {
      return { success: false, error: "Transaction not found" }
    }

    if (transaction.status === "success") {
      return { success: true, status: "success", message: "Already paid" }
    }

    const provider = getPaymentProvider()
    const result = await provider.getTransactionStatus(orderId)

    if (result.status !== transaction.status) {
      // Update the database
      await db.paymentTransaction.update({
        where: { id: transaction.id },
        data: {
          status: result.status,
          paymentType: result.paymentType,
          transactionId: result.transactionId
        }
      })

      // If it's success, update subscription and apply plan changes
      if (result.status === "success" && transaction.subscriptionId) {
        await db.subscription.update({
          where: { id: transaction.subscriptionId },
          data: { 
            status: "active",
            currentPeriodStart: new Date(),
          }
        })

        // Also create the invoice
        await db.invoice.create({
          data: {
            subscriptionId: transaction.subscriptionId,
            amount: transaction.amount,
            currency: "IDR",
            status: "paid",
            paidAt: new Date(),
            midtransInvoiceId: transaction.orderId
          },
        })

        // Apply plan change to User or Tenant based on Order Prefix
        if (orderId.startsWith("SUB") && transaction.subscription?.tenantId) {
          await db.tenant.update({
            where: { id: transaction.subscription.tenantId },
            data: { plan: transaction.subscription.plan },
          })
        } else if (orderId.startsWith("ACC")) {
          await db.user.update({
            where: { id: transaction.subscription.userId },
            data: { plan: transaction.subscription.plan },
          })
        }
      }
    }

    return { success: true, status: result.status }
  } catch (error: any) {
    console.error("Error checking transaction status:", error)
    return { success: false, error: error.message || "Failed to check status" }
  }
}
