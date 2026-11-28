import { db } from "@/lib/database"

// Who may apply a Website Template, the same on every plan:
// - A template with a price is sold once per workspace (lifetime). Buying it makes it "owned".
// - A template without a price is free ("included").
// - The SaCMS Next.js starter is free ("included") even if it carries a price.
export type WebsiteTemplateAccess =
  | "owned" // bought by this workspace (or it is already on the workspace's own access record)
  | "included" // free: the template has no price, or it is the starter
  | "purchasable" // has a price and this workspace has not bought it yet

/** Payment order prefix for one-time template purchases; fulfilled in payment-success.ts. */
export const WEBSITE_TEMPLATE_ORDER_PREFIX = "TPL-"

export function websiteTemplateAccess(
  owned: boolean,
  price: number | null | undefined,
  starter = false,
): WebsiteTemplateAccess {
  if (owned) return "owned"
  if (starter || !(price && price > 0)) return "included"
  return "purchasable"
}

export const WEBSITE_TEMPLATE_ACCESS_MESSAGE: Record<"purchasable", string> = {
  purchasable: "Template ini perlu dibeli terlebih dahulu untuk workspace ini.",
}

/** Resolves this workspace's access to one template, checking its purchase record. */
export async function resolveWebsiteTemplateAccess(
  tenantId: string,
  template: { id: string; price: number | null; isStarter?: boolean },
): Promise<WebsiteTemplateAccess> {
  const owned = !!(await db.websiteTemplatePurchase.findUnique({
    where: { tenantId_websiteTemplateId: { tenantId, websiteTemplateId: template.id } },
    select: { id: true },
  }))
  return websiteTemplateAccess(owned, template.price, !!template.isStarter)
}

export const canApplyWithAccess = (access: WebsiteTemplateAccess) => access === "owned" || access === "included"
