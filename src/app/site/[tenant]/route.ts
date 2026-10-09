import { db } from "@/lib/database"

// Serves a tenant's generated static site (see static-site-generator.ts) as
// one raw HTML response — a route handler, not a page, so it isn't wrapped
// in SaCMS's own root layout. Reached via src/proxy.ts rewriting here: for
// custom domains with domainTarget "site", and for *.sacms.cloud subdomains
// whose tenant has a published site (checked via the static-site:<slug>
// Redis flag before the rewrite even happens).
export async function GET(_req: Request, { params }: { params: Promise<{ tenant: string }> }) {
  const { tenant: tenantSlug } = await params

  const tenant = await db.tenant.findFirst({
    where: { OR: [{ id: tenantSlug }, { slug: tenantSlug }] },
    select: { id: true },
  })
  if (!tenant) {
    return new Response("Not found", { status: 404 })
  }

  const site = await db.tenantStaticSite.findUnique({ where: { tenantId: tenant.id } })
  if (!site || !site.published) {
    return new Response("Not found", { status: 404 })
  }

  const html = site.html.includes("</body>")
    ? site.html.replace("</body>", `<script>${site.js}</script></body>`)
    : `${site.html}\n<script>${site.js}</script>`

  return new Response(html, {
    headers: { "content-type": "text/html; charset=utf-8" },
  })
}
