import { NextResponse } from "next/server"
import { db } from "@/lib/database"
import { withAdminAuth } from "@/lib/api/route-helpers"

export const GET = withAdminAuth(async (request) => {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "50")
    const status = searchParams.get("status")
    const search = searchParams.get("search")

    const where: any = {}
    if (status && status !== "all") where.status = status
    if (search) {
      where.OR = [
        { orderId: { contains: search, mode: "insensitive" } },
        { transactionId: { contains: search, mode: "insensitive" } },
        {
          subscription: {
            tenant: {
              name: { contains: search, mode: "insensitive" }
            }
          }
        }
      ]
    }

    const [total, transactions] = await Promise.all([
      db.paymentTransaction.count({ where }),
      db.paymentTransaction.findMany({
        where,
        select: {
          id: true,
          subscriptionId: true,
          invoiceId: true,
          orderId: true,
          paymentType: true,
          paymentMethod: true,
          amount: true,
          status: true,
          transactionId: true,
          transactionTime: true,
          fraudStatus: true,
          createdAt: true,
          updatedAt: true,
          subscription: {
            select: {
              id: true,
              tenant: {
                select: { name: true, slug: true }
              }
            }
          }
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ])

    return NextResponse.json({
      transactions,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    })
})
