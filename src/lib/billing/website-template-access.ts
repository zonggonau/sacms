import { db } from "@/lib/database"

// Who may apply a Website Template:
// - Standard, Pro, and Business workspaces buy each template once (lifetime).
//   A template without a price is not for sale to them.
// - Enterprise workspaces get every unpriced template free ("included").
//   A priced template is a prepaid template, so Enterprise buys it like everyone else.
export type WebsiteTemplateAccess =
  | "owned" // bought by this workspace
  | "included" // free for this Enterprise workspace (template has no price)
  | "purchasable" // template has a price, workspace has not bought it yet
  | "unavailable" // template not for sale to this workspace

/** Payment order prefix for one-time template purchases; fulfilled in payment-success.ts. */
export const WEBSITE_TEMPLATE_ORDER_PREFIX = "TPL-"

export function websiteTemplateAccess(
  owned: boolean,
  price: number | null | undefined,
  enterprise = false,
): WebsiteTemplateAccess {
  if (owned) return "owned"
  if (price && price > 0) return "purchasable"
  return enterprise ? "included" : "unavailable"
}

export const WEBSITE_TEMPLATE_ACCESS_MESSAGE: Record<Exclude<WebsiteTemplateAccess, "owned" | "included">, string> = {
  purchasable: "Template ini perlu dibeli terlebih dahulu untuk workspace ini.",
  unavailable: "Template ini belum dijual untuk plan workspace ini.",
}

/**
 * True when this workspace is on the Enterprise plan: either Tenant.plan is
 * "enterprise", or its owner holds a valid Enterprise License. Same two signals
 * the feature gates use (see tenant-plan.ts), so one plan means one thing.
 */
export async function isEnterpriseWorkspace(tenantId: string): Promise<boolean> {
  const tenant = await db.tenant.findUnique({ where: { id: tenantId }, select: { plan: true, ownerId: true } })
  if (!tenant) return false
  if ((tenant.plan || "").trim().toLowerCase() === "enterprise") return true
  if (!tenant.ownerId) return false
  const { INSTANCE_LICENSE_ID, isEnterpriseTenant } = await import("@/lib/license")
  return isEnterpriseTenant(INSTANCE_LICENSE_ID, tenant.ownerId)
}

/** Resolves this workspace's access to one template, checking its purchase record and plan. */
export async function resolveWebsiteTemplateAccess(
  tenantId: string,
  template: { id: string; price: number | null },
): Promise<WebsiteTemplateAccess> {
  const owned = !!(await db.websiteTemplatePurchase.findUnique({
    where: { tenantId_websiteTemplateId: { tenantId, websiteTemplateId: template.id } },
    select: { id: true },
  }))
  // A priced template is always purchased, so the plan only matters when it is unpriced.
  const enterprise = !owned && !((template.price ?? 0) > 0) && (await isEnterpriseWorkspace(tenantId))
  return websiteTemplateAccess(owned, template.price, enterprise)
}

export const canApplyWithAccess = (access: WebsiteTemplateAccess) => access === "owned" || access === "included"
