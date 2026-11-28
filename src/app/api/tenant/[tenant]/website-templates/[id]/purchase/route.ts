import { NextResponse } from "next/server"
import { db } from "@/lib/database"
import { createSnapPayment } from "@/lib/midtrans"
import { PAYMENT_WINDOW_MS } from "@/lib/billing/payment-window"
import { withStaffAuth, apiError } from "@/lib/api/route-helpers"
import { WEBSITE_TEMPLATE_ACCESS_MESSAGE, WEBSITE_TEMPLATE_ORDER_PREFIX, isEnterpriseWorkspace, websiteTemplateAccess } from "@/lib/billing/website-template-access"
const MIDTRANS_TEXT_MAX = 50
// An unpaid order is reused only while it is still payable (see payment-window.ts).
const PENDING_ORDER_WINDOW_MS = PAYMENT_WINDOW_MS
const clip = (text: string) => (text.length <= MIDTRANS_TEXT_MAX ? text : `${text.slice(0, MIDTRANS_TEXT_MAX - 1)}…`)

/**
 * POST /api/tenant/[tenant]/website-templates/[id]/purchase
 * Starts a one-time Midtrans checkout for a workspace to own one
 * template. The purchase row is written only when payment fulfillment confirms
 * the TPL- order (see lib/billing/payment-success.ts).
 */
export const POST = withStaffAuth(
  async (_req, context, { access, session }) => {
    const { id } = await context.params
    const tenant = access.tenant

    const template = await db.websiteTemplate.findFirst({
      where: { id, published: true, deletedAt: null },
      select: { id: true, name: true, price: true, isStarter: true },
    })
    if (!template) return apiError("not_found", { message: "Website Template tidak ditemukan" })

    const owned = await db.websiteTemplatePurchase.findUnique({
      where: { tenantId_websiteTemplateId: { tenantId: tenant.id, websiteTemplateId: template.id } },
      select: { id: true },
    })
    const enterprise = !owned && !template.price && (await isEnterpriseWorkspace(tenant.id))
    const templateAccess = websiteTemplateAccess(!!owned, template.price, enterprise, template.isStarter)
    if (templateAccess === "owned") {
      return apiError("conflict", { message: "Template ini sudah bisa digunakan workspace ini, tidak perlu dibeli." })
    }
    if (templateAccess === "included") {
      return apiError("conflict", { message: "Template ini gratis untuk workspace ini, tidak perlu dibeli." })
    }
    if (templateAccess !== "purchasable" || !template.price) {
      return apiError("plan_limit", { message: WEBSITE_TEMPLATE_ACCESS_MESSAGE[templateAccess] })
    }

    // A double click, or a retry after the payment tab was closed, must not create a
    // second order for the same template: two paid orders would charge twice, and
    // only one purchase row can be written. Reuse the still-pending order instead.
    const pending = await db.paymentTransaction.findFirst({
      where: {
        status: "pending",
        amount: template.price,
        createdAt: { gte: new Date(Date.now() - PENDING_ORDER_WINDOW_MS) },
        AND: [
          { rawResponse: { path: ["type"], equals: "WEBSITE_TEMPLATE_PURCHASE" } },
          { rawResponse: { path: ["tenantId"], equals: tenant.id } },
          { rawResponse: { path: ["websiteTemplateId"], equals: template.id } },
        ],
      },
      orderBy: { createdAt: "desc" },
      select: { orderId: true, amount: true, rawResponse: true },
    })
    const reusable = pending?.rawResponse as { token?: string; redirectUrl?: string } | null | undefined
    if (pending && reusable?.redirectUrl) {
      return NextResponse.json({ success: true, orderId: pending.orderId, amount: pending.amount, token: reusable.token, redirectUrl: reusable.redirectUrl, reused: true })
    }

    const orderId = `${WEBSITE_TEMPLATE_ORDER_PREFIX}${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`
    const name = session.user.name || session.user.email || "Pelanggan SaCMS"
    // Snap first: if Midtrans refuses, no pending order is left behind.
    const snap = await createSnapPayment({
      orderId,
      amount: template.price,
      customerDetails: { firstName: name, email: session.user.email || "" },
      items: [{ id: clip(`template_${template.id}`), name: clip(`Website Template ${template.name}`), price: template.price, quantity: 1 }],
    })
    const subscription = await db.subscription.findFirst({ where: { tenantId: tenant.id }, orderBy: { createdAt: "desc" }, select: { id: true } })

    await db.paymentTransaction.create({
      data: {
        orderId,
        amount: template.price,
        status: "pending",
        subscriptionId: subscription?.id ?? null,
        rawResponse: {
          type: "WEBSITE_TEMPLATE_PURCHASE",
          tenantId: tenant.id,
          websiteTemplateId: template.id,
          templateName: template.name,
          price: template.price,
          token: snap.token,
          redirectUrl: snap.redirect_url,
        },
      },
    })

    return NextResponse.json({ success: true, orderId, amount: template.price, token: snap.token, redirectUrl: snap.redirect_url })
  },
  { minRole: "admin" },
)
