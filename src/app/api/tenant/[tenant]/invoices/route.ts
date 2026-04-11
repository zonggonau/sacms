import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/database"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tenant: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { tenant: tenantSlug } = await params

    // Find tenant
    const tenant = await db.tenant.findFirst({
      where: {
        OR: [{ slug: tenantSlug }, { id: tenantSlug }],
      },
      include: {
        members: true,
      },
    })

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 })
    }

    // Check if user is a member
    const membership = tenant.members.find((m) => m.userId === session.user.id)
    const isSuperAdmin = session.user.role === "super_admin"

    if (!membership && !isSuperAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Get all subscriptions for this tenant
    const subscriptions = await db.subscription.findMany({
      where: { tenantId: tenant.id },
    })

    if (subscriptions.length === 0) {
      return NextResponse.json({ invoices: [] })
    }

    // Get all subscription IDs
    const subscriptionIds = subscriptions.map((s) => s.id)

    // Get all invoices
    const invoices = await db.invoice.findMany({
      where: {
        subscriptionId: {
          in: subscriptionIds,
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    })

    return NextResponse.json({
      invoices: invoices.map((inv) => ({
        id: inv.id,
        amount: inv.amount,
        currency: inv.currency,
        status: inv.status,
        midtransInvoiceId: inv.midtransInvoiceId,
        paidAt: inv.paidAt,
        createdAt: inv.createdAt,
      })),
    })
  } catch (error) {
    console.error("Error fetching invoices:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}