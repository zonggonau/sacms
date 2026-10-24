import { db } from "@/lib/database"
import { fulfillAddonOrder, mergeProviderResponse } from "./addon-fulfillment"
import { triggerWebhooks } from "@/lib/webhooks"
import { logAudit, AuditAction } from "@/lib/audit-log"
import { calculatePeriodEndDate, type PlanType } from "@/lib/midtrans"

export type PaymentOutcome = "success" | "failed"

export interface ApplyPaymentOutcomeOptions {
  /** Raw provider payload to merge into PaymentTransaction.rawResponse (see mergeProviderResponse). */
  rawProviderPayload?: unknown
  paymentType?: string | null
  paymentMethod?: string | null
  transactionId?: string | null
  transactionTime?: Date | null
  fraudStatus?: string | null
}

export interface ApplyPaymentOutcomeResult {
  applied: boolean
  /** True if the transaction was already in a terminal state (success/failed) — not an error, just a no-op. */
  alreadyProcessed?: boolean
  status?: PaymentOutcome
}

/**
 * The single place a payment's terminal outcome (success or failure) gets
 * applied to the database. Used by the Midtrans webhook, the client-facing
 * status-poll route, and checkTransactionStatusAction — all three used to
 * reimplement this independently and had already drifted: one of them had
 * no handling at all for AI-credit/addon orders, yet still marked their
 * invoice "paid".
 *
 * Idempotent via an atomic claim: `updateMany` with a `status: { notIn:
 * [success, failed] }` guard only succeeds for the FIRST caller to reach a
 * given transaction — a retried webhook delivery racing the client's own
 * 3-second status poll can't both run the fulfillment side effects (credit
 * grants, invoice creation) for the same payment twice.
 *
 * For a plan upgrade/downgrade (orderId starts with "SUB"), the plan and
 * billing period are resolved HERE, from `rawResponse.intendedPlan` /
 * `.intendedInterval` — checkout (see checkout/route.ts) intentionally never
 * writes the intended plan to Subscription.plan/currentPeriodEnd itself, so
 * an abandoned/unpaid checkout can't pollute the proration baseline the
 * NEXT checkout's calculateProratedAmount() reads.
 */
export async function applyPaymentOutcome(
  orderId: string,
  outcome: PaymentOutcome,
  opts: ApplyPaymentOutcomeOptions = {},
): Promise<ApplyPaymentOutcomeResult> {
  const transaction = await db.paymentTransaction.findUnique({
    where: { orderId },
    include: { subscription: { include: { tenant: true, user: true } } },
  })
  if (!transaction) return { applied: false }

  if (transaction.status === "success" || transaction.status === "failed") {
    return { applied: false, alreadyProcessed: true, status: transaction.status as PaymentOutcome }
  }

  const claim = await db.paymentTransaction.updateMany({
    where: { id: transaction.id, status: { notIn: ["success", "failed"] } },
    data: {
      status: outcome,
      ...(opts.paymentType !== undefined ? { paymentType: opts.paymentType } : {}),
      ...(opts.paymentMethod !== undefined ? { paymentMethod: opts.paymentMethod } : {}),
      ...(opts.transactionId !== undefined ? { transactionId: opts.transactionId } : {}),
      ...(opts.transactionTime !== undefined ? { transactionTime: opts.transactionTime } : {}),
      ...(opts.fraudStatus !== undefined ? { fraudStatus: opts.fraudStatus } : {}),
      ...(opts.rawProviderPayload !== undefined
        ? { rawResponse: mergeProviderResponse(transaction.rawResponse, opts.rawProviderPayload) as any }
        : {}),
    },
  })
  if (claim.count === 0) {
    // Lost the race to another caller already processing this transaction.
    return { applied: false, alreadyProcessed: true }
  }

  const sub = transaction.subscription
  const raw = (transaction.rawResponse as any) || {}

  if (outcome === "failed") {
    if (transaction.subscriptionId) {
      await db.subscription.update({ where: { id: transaction.subscriptionId }, data: { status: "expired" } })
      await db.invoice.create({
        data: { subscriptionId: transaction.subscriptionId, amount: transaction.amount, currency: "IDR", status: "failed" },
      })
    }
    if (sub?.tenantId) {
      triggerWebhooks(sub.tenantId, "payment.failed", { orderId, amount: transaction.amount, reason: outcome }).catch(() => {})
    }
    logAudit({
      tenantId: sub?.tenantId ?? undefined,
      userId: sub?.userId ?? undefined,
      action: AuditAction.SETTINGS_UPDATED,
      entity: "PaymentTransaction",
      entityId: transaction.id,
      data: { orderId, newStatus: "failed" },
    })
    return { applied: true, status: "failed" }
  }

  // outcome === "success"
  let finalPlan = sub?.plan
  let periodEnd: Date | null = sub?.currentPeriodEnd ?? null
  // SUB (tenant workspace plan) and ACC (personal account plan) are both
  // real plan changes that go through the same deferred-write dance in
  // checkout/route.ts — AIC (AI credit top-up) and ADD (addon) never touch
  // Subscription.plan at all, so they're excluded here.
  const isPlanChangeOrder = orderId.startsWith("SUB") || orderId.startsWith("ACC")

  if (transaction.subscriptionId && sub) {
    if (isPlanChangeOrder) {
      // The plan the tenant actually intended to buy — see checkout/route.ts,
      // which stores this instead of writing Subscription.plan up front.
      const intendedPlan: PlanType = raw.intendedPlan || sub.plan
      const intendedInterval: "month" | "year" = raw.intendedInterval === "year" ? "year" : "month"
      finalPlan = intendedPlan
      periodEnd = calculatePeriodEndDate(intendedPlan, intendedInterval)
    }

    await db.subscription.update({
      where: { id: transaction.subscriptionId },
      data: {
        status: "active",
        ...(isPlanChangeOrder ? { plan: finalPlan, currentPeriodStart: new Date(), currentPeriodEnd: periodEnd } : {}),
      },
    })

    await db.invoice.create({
      data: {
        subscriptionId: transaction.subscriptionId,
        amount: transaction.amount,
        currency: "IDR",
        status: "paid",
        paidAt: new Date(),
        midtransInvoiceId: transaction.orderId,
      },
    })

    if (orderId.startsWith("SUB") && sub.tenantId) {
      const hostingExpiry = periodEnd || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
      await db.tenant.update({
        where: { id: sub.tenantId },
        data: { plan: finalPlan, hostingStatus: "active", hostingExpiresAt: hostingExpiry } as any,
      })
    } else if (orderId.startsWith("ACC") && sub.userId) {
      await db.user.update({ where: { id: sub.userId }, data: { plan: finalPlan } })
    } else if (orderId.startsWith("AIC") && sub.userId) {
      let creditsToAdd = Number(raw.credits || 0)
      const addonId = raw.addonId || ""
      if (!creditsToAdd) {
        const { AI_CREDIT_PACKS } = await import("@/lib/constants/tenant-limits")
        const pack = AI_CREDIT_PACKS.find((p) => p.id === addonId)
        if (pack) creditsToAdd = pack.credits
      }
      if (creditsToAdd > 0) {
        await db.user.update({ where: { id: sub.userId }, data: { aiCreditsExtra: { increment: creditsToAdd } } })
        await db.aiQuotaLedger.create({
          data: { userId: sub.userId, action: "topup_credits", credits: creditsToAdd, tokens: creditsToAdd * 1000, model: "topup_pack" },
        })
      }
    } else if (orderId.startsWith("ADD") && sub.tenantId) {
      const addonId = raw.addonId || ""
      if (addonId === "topup_ai_500k") {
        await db.tenant.update({ where: { id: sub.tenantId }, data: { aiCreditsExtra: { increment: 500000 } } as any })
      } else if (addonId === "topup_ai_2m") {
        await db.tenant.update({ where: { id: sub.tenantId }, data: { aiCreditsExtra: { increment: 2000000 } } as any })
      } else if (await fulfillAddonOrder({ tenantId: sub.tenantId, orderId, raw, userId: sub.userId })) {
        // storage add-on or managed database/storage service — handled above.
      } else if (addonId === "topup_api_500k") {
        await db.tenant.update({ where: { id: sub.tenantId }, data: { apiCallsExtra: { increment: 500000 } } as any })
      } else if (addonId === "hosting_annual_1yr" || addonId === "hosting_bundle_domain_1yr") {
        const oneYearFromNow = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
        await db.tenant.update({
          where: { id: sub.tenantId },
          data: { hostingStatus: "active", hostingExpiresAt: oneYearFromNow } as any,
        })
        await Promise.all([
          db.setting.upsert({
            where: { key: `${sub.tenantId}_hostingStatus` },
            update: { value: "active" },
            create: { tenantId: sub.tenantId, key: `${sub.tenantId}_hostingStatus`, value: "active" },
          }),
          db.setting.upsert({
            where: { key: `${sub.tenantId}_hostingExpiresAt` },
            update: { value: oneYearFromNow.toISOString() },
            create: { tenantId: sub.tenantId, key: `${sub.tenantId}_hostingExpiresAt`, value: oneYearFromNow.toISOString() },
          }),
        ])
      }
    }
  } else if (orderId.startsWith("DOM")) {
    const tenantId = raw.tenantId
    const domainName = raw.domainName
    const expectedPriceUsd = raw.expectedPriceUsd || 14
    const contactInformation = raw.contactInformation
    if (tenantId && domainName) {
      const { purchaseDomain } = await import("@/lib/vercel-registrar")
      const purchaseRes = await purchaseDomain(domainName, {
        expectedPrice: expectedPriceUsd,
        years: raw.periodYears || 1,
        autoRenew: false,
        contactInformation: contactInformation || {
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
      if (purchaseRes.success) {
        const currentCount = await db.customDomain.count({ where: { tenantId } })
        await db.customDomain.upsert({
          where: { domain: domainName },
          create: { tenantId, domain: domainName, status: "verified", verifiedAt: new Date(), isPrimary: currentCount === 0 },
          update: { status: "verified", verifiedAt: new Date() },
        })
        const tenant = await db.tenant.findUnique({ where: { id: tenantId }, select: { slug: true } })
        if (tenant) {
          const { getRedis } = await import("@/lib/redis")
          const redis = getRedis()
          if (redis) await redis.set(`domain:${domainName}`, tenant.slug)
        }
      } else {
        console.error(`[applyPaymentOutcome] Domain purchase failed for ${domainName}:`, purchaseRes.error)
      }
    }
  }

  if (sub?.tenantId) {
    triggerWebhooks(sub.tenantId, "payment.completed", { orderId, amount: transaction.amount, plan: finalPlan }).catch(() => {})
  }

  logAudit({
    tenantId: sub?.tenantId ?? undefined,
    userId: sub?.userId ?? undefined,
    action: AuditAction.SETTINGS_UPDATED,
    entity: "PaymentTransaction",
    entityId: transaction.id,
    data: { orderId, newStatus: "success", plan: finalPlan },
  })

  return { applied: true, status: "success" }
}
