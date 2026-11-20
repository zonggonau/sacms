import { randomUUID } from "node:crypto"
import { expect, it, vi } from "vitest"
import { db } from "@/lib/database"
import { advanceBillingPeriod } from "@/lib/billing/plan-price"
import { generateMonthlyInvoices } from "@/lib/billing/generate-invoices"
import { removeWorkspace } from "@/lib/workspace-deletion"

vi.mock("@/lib/r2", () => ({ deleteTenantStorage: async () => undefined }))

const url = new URL(process.env.DATABASE_URL || "postgresql://localhost/missing")
if (process.env.SACMS_WORKFLOW_CI !== "1" ||
  !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
  url.pathname !== "/sacms_workflow_ci") {
  throw new Error("Run against the disposable billing integration database.")
}

it("renews annual terms once and retains invoices and payments when their workspace and account are deleted", async () => {
  const id = randomUUID()
  const user = await db.user.create({ data: { email: `${id}@example.test` } })
  const workspace = await db.tenant.create({ data: { name: "Annual fixture", slug: id } })
  const periodEnd = new Date(Date.now() - 86_400_000)
  const testPlan = `annual-${id}`
  const subscription = await db.subscription.create({
    data: {
      userId: user.id,
      tenantId: workspace.id,
      plan: testPlan,
      status: "active",
      currentPeriodStart: new Date(periodEnd.getTime() - 30 * 86_400_000),
      currentPeriodEnd: periodEnd,
    },
  })
  const payment = await db.paymentTransaction.create({
    data: {
      subscriptionId: subscription.id,
      orderId: `SUB-${id}`,
      status: "success",
      fulfillmentStatus: "completed",
      amount: 111_000,
      rawResponse: { intendedPlan: testPlan, intendedInterval: "year", intendedRecurringAmount: 120_000 },
    },
  })
  try {
    await Promise.all([generateMonthlyInvoices(), generateMonthlyInvoices()])
    const renewed = await db.subscription.findUniqueOrThrow({ where: { id: subscription.id }, include: { invoices: true } })
    expect(renewed).toMatchObject({
      billingInterval: "year",
      recurringAmount: 120_000,
      currentPeriodEnd: advanceBillingPeriod(periodEnd, "year"),
      invoices: [{ amount: 120_000, status: "pending" }],
    })

    await removeWorkspace(workspace)
    await db.user.delete({ where: { id: user.id } })
    const archived = await db.subscription.findUniqueOrThrow({
      where: { id: subscription.id },
      include: { invoices: true, paymentTransactions: true },
    })
    expect(archived).toMatchObject({
      status: "archived", tenantId: null, userId: null, tenantNameSnapshot: workspace.name,
      invoices: [{ id: renewed.invoices[0].id, amount: 120_000 }],
      paymentTransactions: [{ id: payment.id, amount: 111_000 }],
    })
  } finally {
    await db.paymentTransaction.deleteMany({ where: { id: payment.id } })
    await db.invoice.deleteMany({ where: { subscriptionId: subscription.id } })
    await db.subscription.deleteMany({ where: { id: subscription.id } })
    await db.tenant.deleteMany({ where: { id: workspace.id } })
    await db.user.deleteMany({ where: { id: user.id } })
  }
})
