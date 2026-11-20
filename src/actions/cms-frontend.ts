"use server"

import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/database"
import { logAudit, AuditAction } from "@/lib/audit-log"
import { revalidatePath } from "next/cache"

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

const EMPTY_PAGE_HERO = { badge: "", title: "", description: "", cta_primary: "", cta_secondary: "" }
const EMPTY_LOCAL_PRIDE = { badge: "", title: "", description: "" }
const EMPTY_CTA_BANNER = { title: "", description: "", button_primary_text: "", button_secondary_text: "" }
const EMPTY_ABOUT = { title: "", description: "", mission: "", founded: "", image: "" }
const EMPTY_WHATSAPP = { phone: "", message: "", label: "", is_active: true }
const EMPTY_FOOTER = { brand_name: "", description: "", copyright: "" }

/** Reads the single `sacms-landing-page` entry and reshapes it into one
 *  object per editable section (see CMS_SECTIONS in cms-section-config.ts). */
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

    return {
      data: {
        fitur_hero: lp.fitur_hero ?? EMPTY_PAGE_HERO,
        harga_hero: lp.harga_hero ?? EMPTY_PAGE_HERO,
        tentang_hero: lp.tentang_hero ?? EMPTY_PAGE_HERO,
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
    "fitur_hero", "harga_hero", "tentang_hero",
    "features", "workflows", "faqs", "owners", "testimonials",
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

    lp = { ...lp, [section]: value }

    // Can't use upsert's compound-unique `where` here — Prisma's generated
    // tenantId_singleTypeId_locale selector requires tenantId to be a real
    // string, and throws "Argument `tenantId` must not be null" at runtime
    // even though the column itself is nullable and a plain `where` filter
    // (the `existing` lookup above) accepts null just fine. Branch on
    // `existing` instead, same net effect.
    if (existing) {
      await db.tenantSingleTypeAssignment.update({
        where: { id: existing.id },
        data: { data: lp as any, enabled: true, publishedAt: new Date() },
      })
    } else {
      await db.tenantSingleTypeAssignment.create({
        data: {
          tenantId: null,
          singleTypeId: singleType.id,
          locale: "id",
          enabled: true,
          publishedAt: new Date(),
          data: lp as any,
        },
      })
    }

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
