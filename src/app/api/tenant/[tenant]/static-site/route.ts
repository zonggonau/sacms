import { NextResponse } from "next/server"
import { z } from "zod/v4"
import { db } from "@/lib/database"
import { getRedis } from "@/lib/redis"
import { withStaffAuth, apiError, readJson } from "@/lib/api/route-helpers"
import { generateStaticSite } from "@/lib/static-site-generator"

const generateSchema = z.object({
  prompt: z.string().trim().min(1, "Prompt wajib diisi").max(4000),
  model: z.string().optional(),
})

function staticSiteFlagKey(tenantSlug: string) {
  return `static-site:${tenantSlug}`
}

async function setStaticSiteFlag(tenantSlug: string, published: boolean) {
  const redis = getRedis()
  if (!redis) return
  try {
    if (published) await redis.set(staticSiteFlagKey(tenantSlug), "1")
    else await redis.del(staticSiteFlagKey(tenantSlug))
  } catch {
    // Redis is a fast-path cache for proxy.ts's routing check — if it's
    // unavailable, that check just falls back to the CMS Studio default.
  }
}

export const GET = withStaffAuth(async (_req, _context, { access }) => {
  const site = await db.tenantStaticSite.findUnique({ where: { tenantId: access.tenantId } })
  return NextResponse.json({ site })
})

export const POST = withStaffAuth(
  async (req, _context, { access, session }) => {
    const parsed = await readJson(req, generateSchema)
    if (!parsed.ok) return parsed.response

    let result
    try {
      result = await generateStaticSite(parsed.data.prompt, access.tenantId, access.tenant.slug, session.user.id, parsed.data.model)
    } catch (err: any) {
      return apiError("internal", { message: err.message || "Gagal membuat website" })
    }

    const site = await db.tenantStaticSite.upsert({
      where: { tenantId: access.tenantId },
      update: { html: result.html, js: result.js, prompt: parsed.data.prompt, published: true },
      create: { tenantId: access.tenantId, html: result.html, js: result.js, prompt: parsed.data.prompt, published: true },
    })

    await setStaticSiteFlag(access.tenant.slug, true)

    return NextResponse.json({ site })
  },
  { minRole: "admin" },
)

export const DELETE = withStaffAuth(
  async (_req, _context, { access }) => {
    const site = await db.tenantStaticSite.findUnique({ where: { tenantId: access.tenantId } })
    if (!site) return apiError("not_found", { message: "Website belum pernah dibuat" })

    await db.tenantStaticSite.update({ where: { tenantId: access.tenantId }, data: { published: false } })
    await setStaticSiteFlag(access.tenant.slug, false)

    return NextResponse.json({ success: true })
  },
  { minRole: "admin" },
)
