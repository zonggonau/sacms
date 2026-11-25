import { redirect } from "next/navigation"

// Hosting & Infrastruktur moved out of the Developer Portal into the main
// workspace sidebar. This route only keeps old links (MCP hostingUrl, docs,
// bookmarks) working.
export default async function DeveloperInfrastructureRedirect({ params, searchParams }: {
  params: Promise<{ tenant: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const [{ tenant }, query] = await Promise.all([params, searchParams])
  const qs = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    for (const v of Array.isArray(value) ? value : value === undefined ? [] : [value]) qs.append(key, v)
  }
  const search = qs.toString()
  redirect(`/dashboard/${encodeURIComponent(tenant)}/infrastructure${search ? `?${search}` : ""}`)
}
