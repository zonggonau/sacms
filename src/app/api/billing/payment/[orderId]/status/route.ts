import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/database"
import { getTransactionStatus } from "@/lib/midtrans"
import { applyPaymentOutcome } from "@/lib/billing/payment-success"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { orderId } = await params

    // Find transaction
    let transaction = await db.paymentTransaction.findUnique({
      where: { orderId },
      include: {
        subscription: {
          include: {
            tenant: {
              include: {
                members: true,
              },
            },
          },
        },
      },
    })

    if (!transaction) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 })
    }

    // Verify user has access to this tenant (or if it's an account plan, check
    // userId) BEFORE doing anything that mutates state. This used to run
    // after the Midtrans sync below, which meant any authenticated user who
    // knew (or enumerated) another tenant's orderId could trigger that
    // tenant's plan activation / credit grant before being told "forbidden" —
    // the mutation already happened by then.
    let hasAccess = false
    const isSuperAdmin = session.user.role === "super_admin"

    if (transaction.subscription?.tenant) {
      const membership = transaction.subscription.tenant.members.find(
        (m) => m.userId === session.user.id
      )
      hasAccess = !!membership || isSuperAdmin
    } else if (transaction.subscription?.userId) {
      // Account-level plan
      hasAccess = transaction.subscription.userId === session.user.id || isSuperAdmin
    } else if (orderId.startsWith("DOM")) {
      const raw = (transaction.rawResponse as any) || {}
      if (raw.tenantId) {
        const member = await db.tenantMember.findUnique({
          where: {
            tenantId_userId: {
              tenantId: raw.tenantId,
              userId: session.user.id,
            },
          },
        })
        hasAccess = !!member || isSuperAdmin
      } else {
        hasAccess = isSuperAdmin
      }
    } else {
      hasAccess = isSuperAdmin
    }

    if (!hasAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // SYNC WITH MIDTRANS IF PENDING — now safely after the access check above.
    if (transaction.status === "pending") {
      try {
        const midtransStatus = await getTransactionStatus(orderId)
        if (midtransStatus && (midtransStatus.transaction_status === "capture" || midtransStatus.transaction_status === "settlement")) {
          await applyPaymentOutcome(orderId, "success", {
            rawProviderPayload: midtransStatus,
            paymentType: midtransStatus.payment_type || null,
            transactionId: midtransStatus.transaction_id || null,
            transactionTime: midtransStatus.transaction_time ? new Date(midtransStatus.transaction_time) : new Date(),
            fraudStatus: midtransStatus.fraud_status || null,
          })
        } else if (midtransStatus && (midtransStatus.transaction_status === "cancel" || midtransStatus.transaction_status === "deny" || midtransStatus.transaction_status === "expire")) {
          await applyPaymentOutcome(orderId, "failed", { rawProviderPayload: midtransStatus })
        }
      } catch (err) {
        console.error("Failed to sync with Midtrans:", err)
      }

      // Re-fetch — applyPaymentOutcome may have updated status/subscription.
      transaction = await db.paymentTransaction.findUnique({
        where: { orderId },
        include: {
          subscription: {
            include: {
              tenant: {
                include: {
                  members: true,
                },
              },
            },
          },
        },
      })
      if (!transaction) {
        return NextResponse.json({ error: "Transaction not found" }, { status: 404 })
      }
    }

    return NextResponse.json({
      orderId: transaction.orderId,
      status: transaction.status,
      paymentType: transaction.paymentType,
      paymentMethod: transaction.paymentMethod,
      amount: transaction.amount,
      transactionId: transaction.transactionId,
      createdAt: transaction.createdAt,
      transactionTime: transaction.transactionTime,
      subscription: transaction.subscription
        ? {
            plan: transaction.subscription.plan,
            status: transaction.subscription.status,
            tenant: transaction.subscription.tenant ? {
              slug: transaction.subscription.tenant.slug,
              name: transaction.subscription.tenant.name,
            } : null
          }
        : null,
    })
  } catch (error) {
    console.error("Error fetching transaction status:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
