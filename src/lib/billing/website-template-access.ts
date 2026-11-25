import { db } from "@/lib/database"

// Every plan buys each Website Template once. A template without a price is not for sale.
export type WebsiteTemplateAccess =
  | "owned" // bought by this workspace
  | "purchasable" // template has a price, workspace has not bought it yet
  | "unavailable" // template not for sale

/** Payment order prefix for one-time template purchases; fulfilled in payment-success.ts. */
export const WEBSITE_TEMPLATE_ORDER_PREFIX = "TPL-"

export function websiteTemplateAccess(owned: boolean, price: number | null | undefined): WebsiteTemplateAccess {
  if (owned) return "owned"
  return price && price > 0 ? "purchasable" : "unavailable"
}

export const WEBSITE_TEMPLATE_ACCESS_MESSAGE: Record<Exclude<WebsiteTemplateAccess, "owned">, string> = {
  purchasable: "Template ini perlu dibeli terlebih dahulu untuk workspace ini.",
  unavailable: "Template ini belum dijual.",
}

/** Resolves this workspace's access to one template, checking its purchase record. */
export async function resolveWebsiteTemplateAccess(
  tenantId: string,
  template: { id: string; price: number | null },
): Promise<WebsiteTemplateAccess> {
  const owned = !!(await db.websiteTemplatePurchase.findUnique({
    where: { tenantId_websiteTemplateId: { tenantId, websiteTemplateId: template.id } },
    select: { id: true },
  }))
  return websiteTemplateAccess(owned, template.price)
}

export const canApplyWithAccess = (access: WebsiteTemplateAccess) => access === "owned"
