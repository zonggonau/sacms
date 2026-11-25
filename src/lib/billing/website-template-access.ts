import { db } from "@/lib/database"

// Business workspaces use every Website Template free. Starter and Pro buy each
// template once. Every other plan (Free, Enterprise, Custom) cannot use them.
const FREE_PLANS = new Set(["business", "bisnis"])
const PURCHASE_PLANS = new Set(["starter", "standard", "standar", "pro", "professional", "profesional"])

export type WebsiteTemplateAccess =
  | "free" // Business plan
  | "owned" // bought by this workspace
  | "purchasable" // Starter/Pro, template has a price
  | "unavailable" // Starter/Pro, template not for sale
  | "locked" // plan cannot use templates

/** Payment order prefix for one-time template purchases; fulfilled in payment-success.ts. */
export const WEBSITE_TEMPLATE_ORDER_PREFIX = "TPL-"

const normalizePlan = (plan: string | null | undefined) => (plan || "free").trim().toLowerCase()

export const canPurchaseWebsiteTemplates = (plan: string | null | undefined) => PURCHASE_PLANS.has(normalizePlan(plan))

export function websiteTemplateAccess(plan: string | null | undefined, owned: boolean, price: number | null | undefined): WebsiteTemplateAccess {
  const p = normalizePlan(plan)
  if (FREE_PLANS.has(p)) return "free"
  if (!PURCHASE_PLANS.has(p)) return "locked"
  if (owned) return "owned"
  return price && price > 0 ? "purchasable" : "unavailable"
}

export const WEBSITE_TEMPLATE_ACCESS_MESSAGE: Record<Exclude<WebsiteTemplateAccess, "free" | "owned">, string> = {
  purchasable: "Template ini perlu dibeli terlebih dahulu untuk workspace ini.",
  unavailable: "Template ini belum dijual untuk plan workspace Anda.",
  locked: "Website Template tersedia gratis di plan Business, atau bisa dibeli satuan di plan Starter dan Pro. Upgrade plan workspace untuk menggunakannya.",
}

/** Resolves this workspace's access to one template, checking a paid purchase when needed. */
export async function resolveWebsiteTemplateAccess(
  tenantId: string,
  plan: string | null | undefined,
  template: { id: string; price: number | null },
): Promise<WebsiteTemplateAccess> {
  const needsPurchase = canPurchaseWebsiteTemplates(plan)
  const owned = needsPurchase
    ? !!(await db.websiteTemplatePurchase.findUnique({
        where: { tenantId_websiteTemplateId: { tenantId, websiteTemplateId: template.id } },
        select: { id: true },
      }))
    : false
  return websiteTemplateAccess(plan, owned, template.price)
}

export const canApplyWithAccess = (access: WebsiteTemplateAccess) => access === "free" || access === "owned"
