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
    if (planId.startsWith("ai_pack_")) {
      const { AI_CREDIT_PACKS } = await import("@/lib/constants/tenant-limits")
      const pack = AI_CREDIT_PACKS.find(p => p.id === planId)
      if (pack) {
        return {
          id: pack.id,
          name: pack.name,
          priceAmount: pack.price_idr,
          yearlyPrice: pack.price_idr,
          credits: pack.credits,
          isAiCredit: true,
          badge: pack.badge,
          description: pack.description,
          features: pack.features
        }
      }
    }

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

export async function getTransactionHistoryAction(page: number = 1, limit: number = 50) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return { transactions: [], total: 0, page, totalPages: 1 }

    // Fetch user memberships to also get tenant subscriptions — only for
    // tenants this user can actually manage billing for. Without the role
    // filter, any invited member/editor/viewer of a workspace would see
    // that workspace's full payment history (order IDs, amounts, plan) on
    // their own personal billing page, which only the owner/admin should see.
    const memberships = await db.tenantMember.findMany({
      where: { userId: session.user.id, role: { in: ["owner", "admin"] } },
      select: { tenantId: true }
    })
    const tenantIds = memberships.map(m => m.tenantId).filter(Boolean) as string[]

    const subscriptions = await db.subscription.findMany({
      where: {
        OR: [
          { userId: session.user.id },
          ...(tenantIds.length > 0 ? [{ tenantId: { in: tenantIds } }] : [])
        ]
      },
      select: { id: true }
    })
    
    const subIds = subscriptions.map(s => s.id)

    const where = {
      OR: [
        ...(subIds.length > 0 ? [{ subscriptionId: { in: subIds } }] : []),
        { subscription: { userId: session.user.id } },
        ...(tenantIds.length > 0 ? [{ subscription: { tenantId: { in: tenantIds } } }] : [])
      ]
    }

    const skip = (page - 1) * limit

    const [transactions, total] = await Promise.all([
      db.paymentTransaction.findMany({
        where,
        include: {
          subscription: {
            select: {
              plan: true,
              status: true,
              tenantId: true,
              tenant: {
                select: {
                  name: true,
                  slug: true
                }
              }
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      db.paymentTransaction.count({ where }),
    ])

    return { transactions, total, page, totalPages: Math.ceil(total / limit) }
  } catch (error) {
    console.error("Error fetching transactions:", error)
    return { transactions: [], total: 0, page, totalPages: 1 }
  }
}

import { getPaymentProvider } from "@/lib/payment"
import { applyPaymentOutcome } from "@/lib/billing/payment-success"

export async function checkTransactionStatusAction(orderId: string) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return { success: false, error: "Unauthorized" }

    const transaction = await db.paymentTransaction.findUnique({
      where: { orderId },
      include: { subscription: true }
    })

    if (!transaction || !transaction.subscription) {
      return { success: false, error: "Transaction not found" }
    }

    // Authorize by CURRENT standing, not by who happened to run the
    // original checkout: subscription.userId is set once at creation time
    // and goes stale after an ownership transfer or member offboarding.
    // A personal account-level subscription (tenantId null) has no
    // membership concept, so it stays creator-only.
    const sub = transaction.subscription
    const authorized = sub.tenantId === null
      ? sub.userId === session.user.id
      : session.user.role === "super_admin" ||
        (await db.tenantMember.findFirst({
          where: { tenantId: sub.tenantId, userId: session.user.id, role: { in: ["owner", "admin"] } },
          select: { id: true },
        })) !== null

    if (!authorized) {
      return { success: false, error: "Transaction not found" }
    }

    if (transaction.status === "success") {
      return { success: true, status: "success", message: "Already paid" }
    }

    const provider = getPaymentProvider()
    const result = await provider.getTransactionStatus(orderId)

    if (result.status !== transaction.status) {
      if (result.status === "success") {
        await applyPaymentOutcome(orderId, "success", {
          paymentType: result.paymentType,
          transactionId: result.transactionId,
        })
      } else if (result.status === "failed" || result.status === "expired" || result.status === "cancelled") {
        await applyPaymentOutcome(orderId, "failed", {
          paymentType: result.paymentType,
          transactionId: result.transactionId,
        })
      } else {
        // Still pending on the provider's side — just mirror the raw status,
        // no fulfillment side effects yet.
        await db.paymentTransaction.update({
          where: { id: transaction.id },
          data: { status: result.status, paymentType: result.paymentType, transactionId: result.transactionId },
        })
      }
    }

    return { success: true, status: result.status }
  } catch (error: any) {
    console.error("Error checking transaction status:", error)
    return { success: false, error: error.message || "Failed to check status" }
  }
}
