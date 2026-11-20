import { db, type Prisma } from "@/lib/database"
import { fulfillAddonOrder, mergeProviderResponse } from "./addon-fulfillment"
import { triggerWebhooks } from "@/lib/webhooks"
import { logAudit, AuditAction } from "@/lib/audit-log"
import { advanceBillingPeriod } from "./plan-price"
import { AI_CREDIT_PACKS } from "@/lib/constants/tenant-limits"

export type PaymentOutcome = "success" | "failed"

export interface ApplyPaymentOutcomeOptions {
  rawProviderPayload?: unknown
  paymentType?: string | null
  paymentMethod?: string | null
  transactionId?: string | null
  transactionTime?: Date | null
  fraudStatus?: string | null
}

export interface ApplyPaymentOutcomeResult {
  applied: boolean
  alreadyProcessed?: boolean
  status?: PaymentOutcome
}

type PaymentRow = Prisma.PaymentTransactionGetPayload<{ include: { subscription: true } }>
type PaymentForDisplay = { status: string; fulfillmentStatus?: string | null }

const DOMAIN_REVIEW_TIMEOUT_MS = 5 * 60_000

export function isPaymentAwaitingFulfillment(payment: PaymentForDisplay): boolean {
  return payment.status === "success" && ["pending", "processing", "registered"].includes(payment.fulfillmentStatus ?? "")
}

/** Existing polling clients continue polling until purchased benefits are active. */
export function paymentStatusForCheckout(payment: PaymentForDisplay): string {
  if (payment.status === "success" && payment.fulfillmentStatus === "needs_review") return "needs_review"
  return isPaymentAwaitingFulfillment(payment) ? "pending" : payment.status
}

function rawCheckout(payment: PaymentRow): Record<string, any> {
  const value = payment.rawResponse
  return value && typeof value === "object" && !Array.isArray(value) ? value : {}
}

function providerMetadata(payment: PaymentRow, opts: ApplyPaymentOutcomeOptions): Prisma.PaymentTransactionUpdateManyMutationInput {
  return {
    paymentType: opts.paymentType,
    paymentMethod: opts.paymentMethod,
    transactionId: opts.transactionId,
    transactionTime: opts.transactionTime,
    fraudStatus: opts.fraudStatus,
    ...(opts.rawProviderPayload !== undefined
      ? { rawResponse: mergeProviderResponse(payment.rawResponse, opts.rawProviderPayload) as Prisma.InputJsonValue }
      : {}),
  }
}

function notifyPayment(payment: PaymentRow, outcome: PaymentOutcome, plan?: string) {
  const { orderId, subscription } = payment
  const tenantId = subscription?.tenantId ?? rawCheckout(payment).tenantId
  if (tenantId) {
    triggerWebhooks(tenantId, outcome === "success" ? "payment.completed" : "payment.failed", {
      orderId,
      amount: payment.amount,
      ...(outcome === "success" ? { plan } : { reason: outcome }),
    }).catch(() => {})
  }
  logAudit({
    tenantId: tenantId || undefined,
    userId: subscription?.userId ?? undefined,
    action: AuditAction.SETTINGS_UPDATED,
    entity: "PaymentTransaction",
    entityId: payment.id,
    data: { orderId, newStatus: outcome, ...(plan && { plan }) },
  })
}

/**
 * Record the provider outcome independently of fulfillment. Local grants,
 * invoices, and their completion marker commit in one database transaction,
 * so a retry after partial failure can safely pick up a confirmed payment.
 */
export async function applyPaymentOutcome(
  orderId: string,
  outcome: PaymentOutcome,
  opts: ApplyPaymentOutcomeOptions = {},
): Promise<ApplyPaymentOutcomeResult> {
  const existing = await db.paymentTransaction.findUnique({ where: { orderId }, include: { subscription: true } })
  if (!existing) return { applied: false }

  if (outcome === "failed") {
    const applied = await db.$transaction(async (tx) => {
      const claimed = await tx.paymentTransaction.updateMany({
        where: { id: existing.id, status: { notIn: ["success", "failed"] } },
        data: { ...providerMetadata(existing, opts), status: "failed" },
      })
      if (!claimed.count) return false
      // An unsuccessful checkout has no bearing on an already-paid plan.
      if (existing.subscriptionId) {
        await tx.invoice.create({
          data: {
            subscriptionId: existing.subscriptionId,
            amount: existing.amount,
            currency: "IDR",
            status: "failed",
          },
        })
      }
      return true
    })
    if (applied) notifyPayment(existing, "failed")
    return applied ? { applied, status: "failed" } : { applied, alreadyProcessed: true }
  }

  if (existing.status === "failed") {
    return { applied: false, alreadyProcessed: true, status: "failed" }
  }

  let confirmed: PaymentRow | null = existing
  if (existing.status !== "success") {
    await db.paymentTransaction.updateMany({
      where: { id: existing.id, status: { notIn: ["success", "failed"] } },
      data: { ...providerMetadata(existing, opts), status: "success", fulfillmentStatus: "pending" },
    })
    confirmed = await db.paymentTransaction.findUnique({ where: { id: existing.id }, include: { subscription: true } })
  }
  if (!confirmed || confirmed.status !== "success") {
    return { applied: false, alreadyProcessed: true }
  }
  // Null denotes a terminal payment from before fulfillment tracking.
  if (!isPaymentAwaitingFulfillment(confirmed)) {
    return { applied: false, alreadyProcessed: true, status: "success" }
  }

  const isDomain = orderId.startsWith("DOM-")
  if (isDomain && !(await registerPaidDomain(confirmed))) {
    return { applied: false, alreadyProcessed: true, status: "success" }
  }

  const fulfillment = await db.$transaction(async (tx) => {
    const claimed = await tx.paymentTransaction.updateMany({
      where: {
        id: confirmed.id,
        status: "success",
        fulfillmentStatus: isDomain ? "registered" : "pending",
      },
      data: { fulfillmentStatus: "completed" },
    })
    if (!claimed.count) return null

    const domain = isDomain ? await attachRegisteredDomain(tx, confirmed) : undefined
    const plan = isDomain ? undefined : await grantLocalBenefits(tx, confirmed)
    const requiresReview = !isDomain && !!confirmed.subscriptionId && !plan
    let invoiceId = confirmed.invoiceId
    if (invoiceId) {
      await tx.invoice.update({ where: { id: invoiceId }, data: { status: "paid", paidAt: new Date() } })
    } else if (confirmed.subscriptionId) {
      const invoice = await tx.invoice.create({
        data: {
          subscriptionId: confirmed.subscriptionId,
          amount: confirmed.amount,
          currency: "IDR",
          status: "paid",
          paidAt: new Date(),
          midtransInvoiceId: orderId,
        },
      })
      invoiceId = invoice.id
    }
    if (invoiceId && invoiceId !== confirmed.invoiceId) {
      await tx.paymentTransaction.update({ where: { id: confirmed.id }, data: { invoiceId } })
    }
    if (requiresReview) {
      await tx.paymentTransaction.update({ where: { id: confirmed.id }, data: { fulfillmentStatus: "needs_review" } })
    }
    return { plan, domain, requiresReview }
  })
  if (!fulfillment) return { applied: false, alreadyProcessed: true, status: "success" }

  if (fulfillment.domain) {
    const { name, slug } = fulfillment.domain
    const { getRedis } = await import("@/lib/redis")
    await getRedis()?.set(`domain:${name}`, slug).catch((error) => console.warn("[payment] Domain cache update failed:", error))
  }
  if (!fulfillment.requiresReview) notifyPayment(confirmed, "success", fulfillment.plan)
  return { applied: true, status: "success" }
}

async function grantLocalBenefits(tx: Prisma.TransactionClient, payment: PaymentRow) {
  const { orderId, subscription: sub } = payment
  if (!sub || sub.status === "archived") return
  const raw = rawCheckout(payment)
  if (orderId.startsWith("SUB") || orderId.startsWith("ACC")) {
    const isWorkspace = orderId.startsWith("SUB")
    const plan = typeof raw.intendedPlan === "string" ? raw.intendedPlan : sub.plan
    const interval = raw.intendedInterval === "year" ? "year" : "month"
    const recurringAmount = typeof raw.intendedRecurringAmount === "number" &&
      Number.isFinite(raw.intendedRecurringAmount) && raw.intendedRecurringAmount >= 0
      ? raw.intendedRecurringAmount : null
    const now = new Date()
    const periodEnd = advanceBillingPeriod(now, interval)
    const updated = await tx.subscription.updateMany({
      where: {
        id: sub.id,
        status: { not: "archived" },
        ...(isWorkspace
          ? { tenant: { status: { not: "deleting" } } }
          : { userId: { not: null }, tenantId: null, tenantSlugSnapshot: null }),
      },
      data: { status: "active", plan, billingInterval: interval, recurringAmount, currentPeriodStart: now, currentPeriodEnd: periodEnd },
    })
    if (!updated.count) return
    if (isWorkspace && sub.tenantId) {
      await tx.tenant.update({
        where: { id: sub.tenantId },
        data: { plan, hostingStatus: "active", hostingExpiresAt: periodEnd },
      })
    } else if (!isWorkspace && sub.userId) {
      await tx.user.update({ where: { id: sub.userId }, data: { plan } })
    }
    return plan
  }

  if (orderId.startsWith("AIC")) {
    if (!sub.userId) return
    const credits = Number(raw.credits || 0) || AI_CREDIT_PACKS.find((pack) => pack.id === raw.addonId)?.credits || 0
    if (credits > 0) {
      await tx.user.update({ where: { id: sub.userId }, data: { aiCreditsExtra: { increment: credits } } })
      await tx.aiQuotaLedger.create({
        data: { userId: sub.userId, action: "topup_credits", credits, tokens: credits * 1000, model: "topup_pack" },
      })
    }
    return sub.plan
  }

  if (!orderId.startsWith("ADD")) return sub.plan
  if (!sub.tenantId) return
  const tenantId = sub.tenantId
  const addonId = raw.addonId
  if (addonId === "topup_ai_500k" || addonId === "topup_ai_2m") {
    await tx.tenant.update({
      where: { id: tenantId },
      data: { aiCreditsExtra: { increment: addonId === "topup_ai_2m" ? 2_000_000 : 500_000 } },
    })
  } else if (await fulfillAddonOrder({ tenantId, orderId, raw, client: tx })) {
    return sub.plan
  } else if (addonId === "topup_api_500k") {
    await tx.tenant.update({ where: { id: tenantId }, data: { apiCallsExtra: { increment: 500_000 } } })
  } else if (addonId === "hosting_annual_1yr" || addonId === "hosting_bundle_domain_1yr") {
    const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
    await tx.tenant.update({ where: { id: tenantId }, data: { hostingStatus: "active", hostingExpiresAt: expiresAt } })
    for (const [name, value] of [["hostingStatus", "active"], ["hostingExpiresAt", expiresAt.toISOString()]]) {
      const key = `${tenantId}_${name}`
      await tx.setting.upsert({ where: { key }, update: { value }, create: { tenantId, key, value } })
    }
  }
  return sub.plan
}

/**
 * Registrar purchases are an external side effect. A committed claim prevents
 * retries from submitting them twice. Ambiguous outcomes need reconciliation
 * with the registrar, whereas a recorded registration can finish locally.
 */
async function registerPaidDomain(payment: PaymentRow): Promise<boolean> {
  if (payment.fulfillmentStatus === "registered") return true
  if (payment.fulfillmentStatus === "processing") {
    const staleBefore = new Date(Date.now() - DOMAIN_REVIEW_TIMEOUT_MS)
    await db.paymentTransaction.updateMany({
      where: { id: payment.id, fulfillmentStatus: "processing", updatedAt: { lte: staleBefore } },
      data: { fulfillmentStatus: "needs_review" },
    })
    return false
  }

  const claimed = await db.paymentTransaction.updateMany({
    where: { id: payment.id, fulfillmentStatus: "pending" },
    data: { fulfillmentStatus: "processing" },
  })
  if (!claimed.count) return false

  const raw = rawCheckout(payment)
  let registered = false
  try {
    if (!raw.tenantId || !raw.domainName) throw new Error("Missing domain checkout details")
    const workspace = await db.tenant.findFirst({
      where: { id: raw.tenantId, status: { not: "deleting" } },
      select: { id: true },
    })
    if (!workspace) throw new Error("Workspace no longer available for domain registration")
    const { purchaseDomain } = await import("@/lib/vercel-registrar")
    const result = await purchaseDomain(raw.domainName, {
      expectedPrice: raw.expectedPriceUsd || 14,
      years: raw.periodYears || 1,
      autoRenew: false,
      contactInformation: raw.contactInformation || {
        firstName: "Tenant",
        lastName: "Owner",
        address1: "Jakarta",
        city: "Jakarta",
        state: "DKI Jakarta",
        postalCode: "10000",
        country: "ID",
        phone: "+62.812000000",
        email: "domain@sacms.local",
      },
    })
    registered = result.success
  } catch (error) {
    console.error("[payment] Registrar request did not complete:", error)
  }

  await db.paymentTransaction.updateMany({
    where: { id: payment.id, fulfillmentStatus: { in: ["processing", "needs_review"] } },
    data: { fulfillmentStatus: registered ? "registered" : "needs_review" },
  })
  if (!registered) console.warn(`[payment] Domain order ${payment.orderId} needs registrar reconciliation.`)
  return registered
}

async function attachRegisteredDomain(tx: Prisma.TransactionClient, payment: PaymentRow) {
  const { tenantId, domainName } = rawCheckout(payment)
  const currentCount = await tx.customDomain.count({ where: { tenantId } })
  const domain = await tx.customDomain.upsert({
    where: { domain: domainName },
    create: { tenantId, domain: domainName, status: "verified", verifiedAt: new Date(), isPrimary: currentCount === 0 },
    update: {},
  })
  if (domain.tenantId !== tenantId) throw new Error("Domain belongs to another workspace")
  if (domain.status !== "verified") {
    await tx.customDomain.update({ where: { id: domain.id }, data: { status: "verified", verifiedAt: new Date() } })
  }
  const tenant = await tx.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { slug: true } })
  return { name: domainName, slug: tenant.slug }
}

export async function retryPendingPaymentFulfillments() {
  const jobs = await db.paymentTransaction.findMany({
    where: {
      status: "success",
      OR: [
        { fulfillmentStatus: { in: ["pending", "registered"] } },
        { fulfillmentStatus: "processing", updatedAt: { lte: new Date(Date.now() - DOMAIN_REVIEW_TIMEOUT_MS) } },
      ],
    },
    select: { orderId: true },
    orderBy: { updatedAt: "asc" },
    take: 25,
  })
  let completed = 0
  let failed = 0
  for (const { orderId } of jobs) {
    try {
      const result = await applyPaymentOutcome(orderId, "success")
      if (result.applied) completed++
    } catch (error) {
      failed++
      console.error(`[payment] Fulfillment retry failed for ${orderId}:`, error)
      await db.paymentTransaction.updateMany({
        where: { orderId, fulfillmentStatus: { in: ["pending", "registered"] } },
        data: { updatedAt: new Date() },
      }).catch(() => {})
    }
  }
  return { scanned: jobs.length, completed, failed }
}
