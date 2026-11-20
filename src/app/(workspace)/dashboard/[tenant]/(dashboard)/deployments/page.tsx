import { redirect } from "next/navigation"

/**
 * "Hosting & Deployments" and "Custom Domains" were consolidated into the
 * single "Hosting & Infrastruktur" page (../infrastructure) as tabs —
 * Deployments' own Vercel status cards duplicated what the Infrastructure
 * page showed, so the two are now one hub (Overview / Hosting / Domains /
 * Environment / Database & Storage). This route only keeps old links working.
 */
export default async function DeploymentsRedirectPage({ params, searchParams }: {
  params: Promise<{ tenant: string }>
  searchParams: Promise<{ tab?: string }>
}) {
  const [{ tenant }, { tab }] = await Promise.all([params, searchParams])
  redirect(`/dashboard/${encodeURIComponent(tenant)}/infrastructure?tab=${tab === "domains" ? "domains" : "hosting"}`)
}
