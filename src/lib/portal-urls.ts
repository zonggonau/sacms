/**
 * Portal URLs & Cross-Subdomain Routing Helper
 * 
 * Provides unified URL generation for SaCMS Multi-Subdomain Architecture:
 * - admin: admin.sacms.cloud (Workspace Hub, Schema Builder, Subscriptions, Users, Settings)
 * - cms:   cms.sacms.cloud (Content Entries, Media Library, Single Types, Visual Grid)
 * - api:   api.sacms.cloud (Public REST API, GraphQL, Webhooks, Interactive Docs)
 * - app:   sacms.cloud (Apex Landing page, Auth, Pricing)
 */

export type PortalType = "admin" | "cms" | "api" | "app"

export const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN || "sacms.cloud"

/**
 * Returns the base URL for a given portal type
 */
export function getPortalBaseUrl(portal: PortalType): string {
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || "sacms.cloud"

  if (typeof window !== "undefined") {
    const currentHost = window.location.host
    const protocol = window.location.protocol
    // In local development on plain localhost:3000 without root domain configured
    if ((currentHost === "localhost:3000" || currentHost === "127.0.0.1:3000") && !process.env.NEXT_PUBLIC_ROOT_DOMAIN) {
      return `${protocol}//${currentHost}`
    }
  }

  const protocol = process.env.NODE_ENV === "production" ? "https" : "http"

  switch (portal) {
    case "admin":
      return `${protocol}://admin.${rootDomain}`
    case "cms":
      return `${protocol}://cms.${rootDomain}`
    case "api":
      return `${protocol}://api.${rootDomain}`
    case "app":
    default:
      return `${protocol}://${rootDomain}`
  }
}

/**
 * Generates an absolute or relative portal URL with tenant context
 */
export function getPortalUrl(portal: PortalType, tenantSlug?: string, subPath?: string): string {
  const base = getPortalBaseUrl(portal)
  const path = subPath ? (subPath.startsWith("/") ? subPath : `/${subPath}`) : ""

  if (!tenantSlug) {
    return `${base}${path}`
  }

  switch (portal) {
    case "cms":
      return `${base}/${tenantSlug}${path}`
    case "admin":
      return `${base}/${tenantSlug}${path}`
    case "api":
      return `${base}/${tenantSlug}${path}`
    case "app":
    default:
      return `${base}/dashboard/${tenantSlug}${path}`
  }
}
