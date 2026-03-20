import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/database"

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
    const transaction = await db.paymentTransaction.findUnique({
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

    // Verify user has access to this tenant
    const membership = transaction.subscription?.tenant.members.find(
      (m) => m.userId === session.user.id
    )
    const isSuperAdmin = session.user.role === "super_admin"

    if (!membership && !isSuperAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
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
            tenant: {
              slug: transaction.subscription.tenant.slug,
              name: transaction.subscription.tenant.name,
            }
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