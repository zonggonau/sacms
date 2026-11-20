import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/database"
import { isPaymentAwaitingFulfillment, paymentStatusForCheckout } from "@/lib/billing/payment-success"
import { syncPaymentStatus } from "@/lib/billing/sync-payment"

const billingSubscription = { include: { tenant: true } } as const

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
      include: { subscription: billingSubscription },
    })

    if (!transaction) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 })
    }

    const isDomainPurchase = orderId.startsWith("DOM-")
    const raw = transaction.rawResponse
    const domainTenantId = isDomainPurchase && raw && typeof raw === "object" && !Array.isArray(raw) && typeof raw.tenantId === "string"
      ? raw.tenantId : null
    const tenantId = domainTenantId ?? transaction.subscription?.tenantId
    const membership = tenantId ? await db.tenantMember.findUnique({
      where: { tenantId_userId: { tenantId, userId: session.user.id } },
      select: { userId: true },
    }) : null
    const hasAccess = session.user.role === "super_admin" || (tenantId
      ? !!membership
      : !isDomainPurchase && transaction.subscription?.status !== "archived" && transaction.subscription?.userId === session.user.id)
    if (!hasAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    if (transaction.status === "pending" || isPaymentAwaitingFulfillment(transaction)) {
      try {
        await syncPaymentStatus(transaction)
      } catch (error) {
        console.error("Failed to synchronize payment status:", error)
      }
      transaction = await db.paymentTransaction.findUnique({
        where: { orderId },
        include: { subscription: billingSubscription },
      })
      if (!transaction) {
        return NextResponse.json({ error: "Transaction not found" }, { status: 404 })
      }
    }

    const workspace = domainTenantId
      ? await db.tenant.findUnique({ where: { id: domainTenantId }, select: { slug: true, name: true } })
      : transaction.subscription?.tenant
    return NextResponse.json({
      isDomainPurchase,
      workspace: workspace ? { slug: workspace.slug, name: workspace.name } : null,
      orderId: transaction.orderId,
      status: paymentStatusForCheckout(transaction),
      paymentStatus: transaction.status,
      fulfillmentStatus: transaction.fulfillmentStatus,
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
