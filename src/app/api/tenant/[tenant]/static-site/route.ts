import { NextResponse } from "next/server"
import { z } from "zod/v4"
import { db } from "@/lib/database"
import { withStaffAuth, apiError, readJson } from "@/lib/api/route-helpers"
import { generateStaticSite } from "@/lib/static-site-generator"
import { setStaticSiteFlag } from "@/lib/static-site-versions"

const generateSchema = z.object({
  prompt: z.string().trim().min(1, "Prompt wajib diisi").max(4000),
  model: z.string().optional(),
})

const toggleSchema = z.object({
  published: z.boolean(),
})

// GET: current state (live + pending draft) for the dashboard UI.
export const GET = withStaffAuth(async (_req, _context, { access }) => {
  const site = await db.tenantStaticSite.findUnique({ where: { tenantId: access.tenantId } })
  return NextResponse.json({ site })
})

// POST: generate a new DRAFT via AI. Never touches the live/published
// content or the Redis routing flag — a human must explicitly call
// .../publish before this is visible to anyone.
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

    // A fresh Step 1 draft always starts the pipeline over — any earlier
    // "schema_applied"/"api_connected" stage belonged to the PREVIOUS
    // app.js and would no longer match this new one.
    const site = await db.tenantStaticSite.upsert({
      where: { tenantId: access.tenantId },
      update: { draftHtml: result.html, draftJs: result.js, draftPrompt: parsed.data.prompt, draftAt: new Date(), stage: "mock" },
      create: {
        tenantId: access.tenantId,
        html: "",
        js: "",
        published: false,
        draftHtml: result.html,
        draftJs: result.js,
        draftPrompt: parsed.data.prompt,
        draftAt: new Date(),
        stage: "mock",
      },
    })

    return NextResponse.json({ site })
  },
  { minRole: "admin" },
)

// PATCH: show/hide the CURRENT live content (no draft/version involved —
// use .../publish to replace live content with the latest draft instead).
export const PATCH = withStaffAuth(
  async (req, _context, { access }) => {
    const existing = await db.tenantStaticSite.findUnique({ where: { tenantId: access.tenantId } })
    if (!existing || !existing.html) {
      return apiError("not_found", { message: "Belum ada website yang pernah di-publish" })
    }

    const parsed = await readJson(req, toggleSchema)
    if (!parsed.ok) return parsed.response

    const site = await db.tenantStaticSite.update({
      where: { tenantId: access.tenantId },
      data: { published: parsed.data.published },
    })

    await setStaticSiteFlag(access.tenant.slug, parsed.data.published)

    return NextResponse.json({ site })
  },
  { minRole: "admin" },
)

// PUT: manually update draft code (index.html and app.js) from the code editor
const updateCodeSchema = z.object({
  draftHtml: z.string().optional(),
  draftJs: z.string().optional(),
})

export const PUT = withStaffAuth(
  async (req, _context, { access }) => {
    const parsed = await readJson(req, updateCodeSchema)
    if (!parsed.ok) return parsed.response

    const { draftHtml, draftJs } = parsed.data
    // A manual code edit can invalidate the // MOCK: markers or fetch
    // wiring Step 2/3 depended on — reset to "mock" so stale stage badges
    // don't imply a pipeline step that no longer matches the edited JS.
    const site = await db.tenantStaticSite.upsert({
      where: { tenantId: access.tenantId },
      update: {
        ...(draftHtml !== undefined ? { draftHtml, draftAt: new Date() } : {}),
        ...(draftJs !== undefined ? { draftJs, draftAt: new Date() } : {}),
        stage: "mock",
      },
      create: {
        tenantId: access.tenantId,
        html: "",
        js: "",
        published: false,
        draftHtml: draftHtml || "",
        draftJs: draftJs || "",
        draftAt: new Date(),
        stage: "mock",
      },
    })

    return NextResponse.json({ site })
  },
  { minRole: "admin" },
)

// DELETE: permanently removes the site AND its version history (cascades
// via TenantStaticSiteVersion's onDelete: Cascade) — a full reset back to
// "never created". To just hide a live site without losing anything, use
// PATCH {published: false} instead.
export const DELETE = withStaffAuth(
  async (_req, _context, { access }) => {
    const site = await db.tenantStaticSite.findUnique({ where: { tenantId: access.tenantId } })
    if (!site) return apiError("not_found", { message: "Website belum pernah dibuat" })

    await db.tenantStaticSite.delete({ where: { tenantId: access.tenantId } })
    await setStaticSiteFlag(access.tenant.slug, false)

    return NextResponse.json({ success: true })
  },
  { minRole: "admin" },
)
