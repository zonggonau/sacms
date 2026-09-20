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

export async function getAiCreditStatusAction() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return null
    const { enforceUserAiCredits } = await import("@/lib/plan-enforcement")
    const creditStatus = await enforceUserAiCredits(session.user.id, 0)
    return {
      used: creditStatus.current,
      total: creditStatus.max,
      remaining: creditStatus.remaining,
      isUnlimited: creditStatus.max >= 900000
    }
  } catch (error) {
    console.error("Error fetching AI credit status:", error)
    return null
  }
}

export async function getAiCreditPacksAction() {
  try {
    const { AI_CREDIT_PACKS } = await import("@/lib/constants/tenant-limits")
    const aiEntries = await db.contentEntry.findMany({
      where: { contentType: { slug: "sacms-ai-pricing" }, status: "PUBLISHED" },
      orderBy: { createdAt: "asc" }
    })
    if (aiEntries.length > 0) {
      return aiEntries.map(t => {
        const d = (typeof t.data === 'string' ? JSON.parse(t.data) : t.data) as any
        return {
          id: d.pack_slug || t.id,
          name: d.name || "AI Credits",
          credits: Number(d.credits) || 0,
          price_usd: Number(d.price_usd) || 0,
          price_idr: Number(d.price) || 0,
          badge: d.badge || undefined,
          description: d.description || "",
          features: Array.isArray(d.features) ? d.features : []
        }
      }).sort((a, b) => a.price_idr - b.price_idr)
    }
    return AI_CREDIT_PACKS
  } catch (error) {
    console.error("Error fetching AI credit packs:", error)
    const { AI_CREDIT_PACKS } = await import("@/lib/constants/tenant-limits")
    return AI_CREDIT_PACKS
  }
}


export async function getTransactionHistoryAction(page: number = 1, limit: number = 50) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return { transactions: [], total: 0, page, totalPages: 1 }

    // Fetch user memberships to also get tenant subscriptions
    const memberships = await db.tenantMember.findMany({
      where: { userId: session.user.id },
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
import { logAudit, AuditAction } from "@/lib/audit-log"

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

        logAudit({
          userId: session.user.id,
          action: AuditAction.SETTINGS_UPDATED,
          entity: "PaymentTransactionSynced",
          entityId: transaction.id,
          data: { orderId, newStatus: result.status, plan: transaction.subscription.plan },
        })
      }
    }

    return { success: true, status: result.status }
  } catch (error: any) {
    console.error("Error checking transaction status:", error)
    return { success: false, error: error.message || "Failed to check status" }
  }
}
