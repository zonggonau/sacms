"use server"

import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/database"
import { logAudit, AuditAction } from "@/lib/audit-log"
import { revalidatePath } from "next/cache"
import { DEFAULT_LANDING_PAGE_DATA } from "@/lib/default-landing-page"

const LANDING_PAGE_SLUG = "sacms-landing-page"
const BLOG_CONTENT_TYPE_SLUG = "posts"

/**
 * The marketing frontend's actual content lives entirely at `tenantId: null`
 * — both the schema (SingleType/ContentType rows) AND its data
 * (TenantSingleTypeAssignment/ContentEntry rows). It has no workspace owner
 * at all; the "SaCMS Global" tenant that used to anchor the data half of
 * this was retired once nothing needed a dashboard page to manage it
 * through anymore (see getLandingData() in public-api.ts, which reads from
 * the same place).
 */
async function requireSuperAdmin() {
  const session = await getServerSession(authOptions)
  if (!session?.user || session.user.role !== "super_admin") {
    return { session: null, error: "Unauthorized" as const }
  }
  return { session, error: null }
}

function revalidateMarketingPages() {
  for (const path of ["/", "/fitur", "/harga", "/tentang", "/blog"]) {
    revalidatePath(path)
  }
}

const EMPTY_HERO = { badge: "", title: "", subtitle: "", cta_primary: "", cta_secondary: "", image: "" }
const EMPTY_LOCAL_PRIDE = { badge: "", title: "", description: "" }
const EMPTY_CTA_BANNER = { title: "", description: "", button_primary_text: "", button_secondary_text: "" }
const EMPTY_ABOUT = { title: "", description: "", mission: "", founded: "", image: "" }
const EMPTY_WHATSAPP = { phone: "", message: "", label: "", is_active: true }
const EMPTY_FOOTER = { brand_name: "", description: "", copyright: "" }

/**
 * Reads the single `sacms-landing-page` entry and reshapes it into one
 * object per editable section — flattening the `hero_*` root-level keys
 * into a `hero` object to match every other section's own shape, since
 * that's the one section stored flat on the SingleType's data (see
 * seed-all-global.ts's "Landing Page" field list).
 */
export async function getCmsLandingDataAction() {
  const { error } = await requireSuperAdmin()
  if (error) return { error }

  try {
    const singleType = await db.singleType.findFirst({
      where: { slug: LANDING_PAGE_SLUG, tenantId: null },
    })
    if (!singleType) return { error: "Content type sacms-landing-page tidak ditemukan" }

    const assignment = await db.tenantSingleTypeAssignment.findFirst({
      where: { singleTypeId: singleType.id, tenantId: null },
    })

    let lp: Record<string, any> = (assignment?.data as Record<string, any>) || {}
    if (typeof lp === "string") {
      try { lp = JSON.parse(lp) } catch { lp = {} }
    }

    const def = DEFAULT_LANDING_PAGE_DATA

    return {
      data: {
        hero: {
          badge: lp.hero_badge ?? def["sacms-hero"]?.badge_text ?? EMPTY_HERO.badge,
          title: lp.hero_title ?? def["sacms-hero"]?.headline ?? EMPTY_HERO.title,
          subtitle: lp.hero_subtitle ?? def["sacms-hero"]?.subheadline ?? EMPTY_HERO.subtitle,
          cta_primary: lp.hero_cta_primary ?? def["sacms-hero"]?.cta_primary ?? EMPTY_HERO.cta_primary,
          cta_secondary: lp.hero_cta_secondary ?? def["sacms-hero"]?.cta_secondary ?? EMPTY_HERO.cta_secondary,
          image: lp.hero_image ?? def["sacms-hero"]?.image_url ?? EMPTY_HERO.image,
        },
        features: lp.features ?? [],
        workflows: lp.workflows ?? [],
        faqs: lp.faqs ?? [],
        owners: lp.owners ?? [],
        testimonials: lp.testimonials ?? [],
        sectors: lp.sectors ?? [],
        local_pride: lp.local_pride ?? EMPTY_LOCAL_PRIDE,
        cta_banner: lp.cta_banner ?? EMPTY_CTA_BANNER,
        about: lp.about ?? EMPTY_ABOUT,
        whatsapp: lp.whatsapp ?? EMPTY_WHATSAPP,
        footer: lp.footer ?? EMPTY_FOOTER,
      },
      hasEntry: !!assignment,
    }
  } catch (err: any) {
    console.error("Error fetching CMS landing data:", err)
    return { error: err.message || "Internal server error" }
  }
}

/**
 * Saves one section's value back into the shared landing-page JSON blob.
 * `hero` is expanded back into the flat `hero_*` root keys it's actually
 * stored as; every other section is written at `lp[section]` directly.
 */
export async function updateCmsLandingSectionAction(section: string, value: unknown) {
  const { session, error } = await requireSuperAdmin()
  if (error) return { error }

  const VALID_SECTIONS = [
    "hero", "features", "workflows", "faqs", "owners", "testimonials",
    "sectors", "local_pride", "cta_banner", "about", "whatsapp", "footer",
  ]
  if (!VALID_SECTIONS.includes(section)) return { error: "Invalid section" }

  try {
    const singleType = await db.singleType.findFirst({
      where: { slug: LANDING_PAGE_SLUG, tenantId: null },
    })
    if (!singleType) return { error: "Content type sacms-landing-page tidak ditemukan" }

    const existing = await db.tenantSingleTypeAssignment.findFirst({
      where: { singleTypeId: singleType.id, tenantId: null },
    })
    let lp: Record<string, any> = (existing?.data as Record<string, any>) || {}
    if (typeof lp === "string") {
      try { lp = JSON.parse(lp) } catch { lp = {} }
    }

    if (section === "hero") {
      const h = value as typeof EMPTY_HERO
      lp = {
        ...lp,
        hero_badge: h.badge ?? "",
        hero_title: h.title ?? "",
        hero_subtitle: h.subtitle ?? "",
        hero_cta_primary: h.cta_primary ?? "",
        hero_cta_secondary: h.cta_secondary ?? "",
        hero_image: h.image ?? "",
      }
    } else {
      lp = { ...lp, [section]: value }
    }

    await db.tenantSingleTypeAssignment.upsert({
      where: { tenantId_singleTypeId_locale: { tenantId: null as any, singleTypeId: singleType.id, locale: "id" } },
      update: { data: lp as any, enabled: true, publishedAt: new Date() },
      create: {
        tenantId: null,
        singleTypeId: singleType.id,
        locale: "id",
        enabled: true,
        publishedAt: new Date(),
        data: lp as any,
      },
    })

    revalidateMarketingPages()

    logAudit({
      userId: session!.user.id,
      action: AuditAction.CONTENT_UPDATED,
      entity: "landing_page_section",
      entityId: section,
      data: { section },
    })

    return { success: true }
  } catch (err: any) {
    console.error("Error updating CMS landing section:", err)
    // Prisma's own validation/known-request errors echo the ENTIRE query
    // argument object (including the whole `data: {...}` payload) into
    // `.message` for debugging — fine in server logs, but shown as-is in
    // the dashboard's toast it dumped the full imported JSON back at the
    // user instead of a readable error. Keep only a short, safe message
    // client-side; the real error is already logged above.
    const message = typeof err?.message === "string" ? err.message : ""
    const looksLikeRawDump = message.length > 200 || /^Invalid `|PrismaClient/.test(message)
    return { error: looksLikeRawDump ? "Gagal menyimpan: data tidak sesuai format yang diharapkan." : (message || "Internal server error") }
  }
}

// ─── Blog ("posts") — a real multi-entry collection, managed on its own
// page (opened in a new tab from the CMS nav) rather than inside the
// single-entry section editor above. ──────────────────────────────────

export async function listCmsBlogPostsAction() {
  const { error } = await requireSuperAdmin()
  if (error) return { error }

  try {
    const contentType = await db.contentType.findFirst({ where: { slug: BLOG_CONTENT_TYPE_SLUG, tenantId: null } })
    if (!contentType) return { error: "Content type posts tidak ditemukan" }

    const entries = await db.contentEntry.findMany({
      where: { contentTypeId: contentType.id, tenantId: null, deletedAt: null },
      orderBy: { createdAt: "desc" },
    })

    return {
      posts: entries.map((e) => ({
        id: e.id,
        status: e.status,
        createdAt: e.createdAt,
        updatedAt: e.updatedAt,
        ...(typeof e.data === "object" && e.data !== null ? e.data as Record<string, unknown> : {}),
      })),
    }
  } catch (err: any) {
    console.error("Error listing CMS blog posts:", err)
    return { error: err.message || "Internal server error" }
  }
}

interface BlogPostInput {
  title: string
  slug: string
  content: string
  category: string
  cover_image: string
}

export async function createCmsBlogPostAction(input: BlogPostInput, status: "DRAFT" | "PUBLISHED") {
  const { session, error } = await requireSuperAdmin()
  if (error) return { error }
  if (!input.title?.trim() || !input.slug?.trim()) return { error: "Judul dan slug wajib diisi" }

  try {
    const contentType = await db.contentType.findFirst({ where: { slug: BLOG_CONTENT_TYPE_SLUG, tenantId: null } })
    if (!contentType) return { error: "Content type posts tidak ditemukan" }

    const dup = await db.contentEntry.findFirst({
      where: { contentTypeId: contentType.id, tenantId: null, deletedAt: null, data: { path: ["slug"], equals: input.slug } },
    })
    if (dup) return { error: "Slug sudah digunakan oleh post lain" }

    const entry = await db.contentEntry.create({
      data: {
        contentTypeId: contentType.id,
        tenantId: null,
        locale: "id",
        data: input as any,
        status,
        publishedAt: status === "PUBLISHED" ? new Date() : null,
        createdBy: session!.user.id,
        updatedBy: session!.user.id,
      },
    })
    await db.contentEntry.update({ where: { id: entry.id }, data: { documentId: entry.id } })

    revalidatePath("/blog")
    revalidatePath(`/blog/${input.slug}`)

    logAudit({
      userId: session!.user.id,
      action: AuditAction.CONTENT_CREATED,
      entity: "content_entry",
      entityId: entry.id,
      data: { contentType: BLOG_CONTENT_TYPE_SLUG, status },
    })

    return { success: true, id: entry.id }
  } catch (err: any) {
    console.error("Error creating CMS blog post:", err)
    return { error: err.message || "Internal server error" }
  }
}

export async function updateCmsBlogPostAction(id: string, input: BlogPostInput, status: "DRAFT" | "PUBLISHED") {
  const { session, error } = await requireSuperAdmin()
  if (error) return { error }
  if (!input.title?.trim() || !input.slug?.trim()) return { error: "Judul dan slug wajib diisi" }

  try {
    const contentType = await db.contentType.findFirst({ where: { slug: BLOG_CONTENT_TYPE_SLUG, tenantId: null } })
    if (!contentType) return { error: "Content type posts tidak ditemukan" }

    const existing = await db.contentEntry.findFirst({ where: { id, contentTypeId: contentType.id, tenantId: null, deletedAt: null } })
    if (!existing) return { error: "Post tidak ditemukan" }

    const dup = await db.contentEntry.findFirst({
      where: { contentTypeId: contentType.id, tenantId: null, deletedAt: null, id: { not: id }, data: { path: ["slug"], equals: input.slug } },
    })
    if (dup) return { error: "Slug sudah digunakan oleh post lain" }

    const oldSlug = (existing.data as any)?.slug

    await db.contentEntry.update({
      where: { id },
      data: {
        data: input as any,
        status,
        publishedAt: status === "PUBLISHED" ? (existing.publishedAt ?? new Date()) : null,
        updatedBy: session!.user.id,
      },
    })

    revalidatePath("/blog")
    revalidatePath(`/blog/${input.slug}`)
    if (oldSlug && oldSlug !== input.slug) revalidatePath(`/blog/${oldSlug}`)

    logAudit({
      userId: session!.user.id,
      action: AuditAction.CONTENT_UPDATED,
      entity: "content_entry",
      entityId: id,
      data: { contentType: BLOG_CONTENT_TYPE_SLUG, status },
    })

    return { success: true }
  } catch (err: any) {
    console.error("Error updating CMS blog post:", err)
    return { error: err.message || "Internal server error" }
  }
}

export async function deleteCmsBlogPostAction(id: string) {
  const { session, error } = await requireSuperAdmin()
  if (error) return { error }

  try {
    const contentType = await db.contentType.findFirst({ where: { slug: BLOG_CONTENT_TYPE_SLUG, tenantId: null } })
    if (!contentType) return { error: "Content type posts tidak ditemukan" }

    const existing = await db.contentEntry.findFirst({ where: { id, contentTypeId: contentType.id, tenantId: null, deletedAt: null } })
    if (!existing) return { error: "Post tidak ditemukan" }

    // Soft-delete, same convention as every other content entry in this
    // codebase (see src/lib/content/entry-service.ts) — recoverable via the
    // tenant's own Trash until the purge cron clears it, never a hard delete.
    await db.contentEntry.update({ where: { id }, data: { deletedAt: new Date() } })

    revalidatePath("/blog")
    const slug = (existing.data as any)?.slug
    if (slug) revalidatePath(`/blog/${slug}`)

    logAudit({
      userId: session!.user.id,
      action: AuditAction.CONTENT_DELETED,
      entity: "content_entry",
      entityId: id,
      data: { contentType: BLOG_CONTENT_TYPE_SLUG },
    })

    return { success: true }
  } catch (err: any) {
    console.error("Error deleting CMS blog post:", err)
    return { error: err.message || "Internal server error" }
  }
}
