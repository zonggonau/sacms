import { NextResponse } from "next/server"
import { db } from "@/lib/database"
import { createSnapPayment } from "@/lib/midtrans"
import { withStaffAuth, apiError } from "@/lib/api/route-helpers"
import { WEBSITE_TEMPLATE_ACCESS_MESSAGE, WEBSITE_TEMPLATE_ORDER_PREFIX, websiteTemplateAccess } from "@/lib/billing/website-template-access"
const MIDTRANS_TEXT_MAX = 50
const clip = (text: string) => (text.length <= MIDTRANS_TEXT_MAX ? text : `${text.slice(0, MIDTRANS_TEXT_MAX - 1)}…`)

/**
 * POST /api/tenant/[tenant]/website-templates/[id]/purchase
 * Starts a one-time Midtrans checkout for a Starter/Pro workspace to own one
 * template. The purchase row is written only when payment fulfillment confirms
 * the TPL- order (see lib/billing/payment-success.ts).
 */
export const POST = withStaffAuth(
  async (_req, context, { access, session }) => {
    const { id } = await context.params
    const tenant = access.tenant

    const template = await db.websiteTemplate.findFirst({
      where: { id, published: true, deletedAt: null },
      select: { id: true, name: true, price: true },
    })
    if (!template) return apiError("not_found", { message: "Website Template tidak ditemukan" })

    const owned = await db.websiteTemplatePurchase.findUnique({
      where: { tenantId_websiteTemplateId: { tenantId: tenant.id, websiteTemplateId: template.id } },
      select: { id: true },
    })
    const templateAccess = websiteTemplateAccess(tenant.plan, !!owned, template.price)
    if (templateAccess === "free" || templateAccess === "owned") {
      return apiError("conflict", { message: "Template ini sudah bisa digunakan workspace ini, tidak perlu dibeli." })
    }
    if (templateAccess !== "purchasable" || !template.price) {
      return apiError("plan_limit", { message: WEBSITE_TEMPLATE_ACCESS_MESSAGE[templateAccess] })
    }

    const orderId = `${WEBSITE_TEMPLATE_ORDER_PREFIX}${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`
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
        },
      },
    })

    const name = session.user.name || session.user.email || "Pelanggan SaCMS"
    const snap = await createSnapPayment({
      orderId,
      amount: template.price,
      customerDetails: { firstName: name, email: session.user.email || "" },
      items: [{ id: clip(`template_${template.id}`), name: clip(`Website Template ${template.name}`), price: template.price, quantity: 1 }],
    })

    return NextResponse.json({ success: true, orderId, amount: template.price, token: snap.token, redirectUrl: snap.redirect_url })
  },
  { minRole: "admin" },
)
