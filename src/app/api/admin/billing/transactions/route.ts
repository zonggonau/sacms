import { NextResponse } from "next/server"
import { db, type Prisma } from "@/lib/database"
import { withAdminAuth } from "@/lib/api/route-helpers"

const transactionSelect = {
  id: true,
  subscriptionId: true,
  invoiceId: true,
  orderId: true,
  paymentType: true,
  paymentMethod: true,
  amount: true,
  status: true,
  fulfillmentStatus: true,
  transactionId: true,
  transactionTime: true,
  fraudStatus: true,
  createdAt: true,
  updatedAt: true,
  subscription: {
    select: {
      id: true,
      tenant: { select: { name: true, slug: true } },
      tenantNameSnapshot: true,
      tenantSlugSnapshot: true,
      userNameSnapshot: true,
    },
  },
} satisfies Prisma.PaymentTransactionSelect

type Transaction = Prisma.PaymentTransactionGetPayload<{ select: typeof transactionSelect }>

function csvCell(value: string | number | null | undefined): string {
  const text = String(value ?? "")
  const safeText = typeof value === "string" && /^[\s\uFEFF]*[=+\-@]|^[\t\r\n]/.test(text) ? "'" + text : text
  return '"' + safeText.replaceAll('"', '""') + '"'
}

function csvRow(row: Transaction): string {
  return [
    row.orderId,
    row.subscription?.tenant?.slug || row.subscription?.tenantSlugSnapshot || "System",
    row.subscription?.tenant?.name || row.subscription?.tenantNameSnapshot || row.subscription?.userNameSnapshot,
    row.paymentType || row.paymentMethod,
    row.amount,
    row.status,
    row.fulfillmentStatus,
    row.createdAt.toISOString(),
  ].map(csvCell).join(",") + "\r\n"
}

function exportTransactions(where: Prisma.PaymentTransactionWhereInput) {
  const encoder = new TextEncoder()
  const batchSize = 500
  const cutoff = new Date()
  let cursor: string | undefined
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode("\uFEFFOrder ID,Tenant,Name,Payment Method,Amount,Status,Fulfillment,Date\r\n"))
    },
    async pull(controller) {
      const rows = await db.paymentTransaction.findMany({
        where: { ...where, createdAt: { lte: cutoff } },
        select: transactionSelect,
        orderBy: { id: "asc" },
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        take: batchSize,
      })
      if (rows.length) {
        controller.enqueue(encoder.encode(rows.map(csvRow).join("")))
        cursor = rows.at(-1)?.id
      }
      if (rows.length < batchSize) controller.close()
    },
  })
  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="transaksi_sacms.csv"',
      "Cache-Control": "no-store",
    },
  })
}

function boundedNumber(value: string | null, fallback: number, max: number) {
  const parsed = Number(value ?? fallback)
  return Number.isSafeInteger(parsed) && parsed > 0 ? Math.min(parsed, max) : fallback
}

export const GET = withAdminAuth(async (request) => {
  const { searchParams } = new URL(request.url)
  const limit = boundedNumber(searchParams.get("limit"), 50, 100)
  const page = boundedNumber(searchParams.get("page"), 1, Math.floor(2_147_483_647 / limit))
  const status = searchParams.get("status")
  const search = searchParams.get("search")?.trim().slice(0, 200)
  const where: Prisma.PaymentTransactionWhereInput = {}

  if (status === "needs_review") where.fulfillmentStatus = status
  else if (status && status !== "all") where.status = status
  if (search) {
    const match = { contains: search, mode: "insensitive" } as const
    where.OR = [
      { orderId: match },
      { transactionId: match },
      { subscription: { tenant: { name: match } } },
      { subscription: { tenant: { slug: match } } },
      { subscription: { tenantNameSnapshot: match } },
      { subscription: { tenantSlugSnapshot: match } },
      { subscription: { userNameSnapshot: match } },
    ]
  }

  if (searchParams.get("format") === "csv") return exportTransactions(where)
  const [total, transactions] = await Promise.all([
    db.paymentTransaction.count({ where }),
    db.paymentTransaction.findMany({
      where,
      select: transactionSelect,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * limit,
      take: limit,
    }),
  ])
  return NextResponse.json({
    transactions,
    pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
  })
}, { allowRoles: ["finance"] })
