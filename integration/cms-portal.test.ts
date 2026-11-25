import { afterAll, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import { getTenantAccess } from "@/lib/tenant-access"
import { db, PrismaClient } from "@/lib/database"
import { getEntriesAction } from "@/actions/content"
import { GET as exportBackup } from "@/app/api/tenant/[tenant]/export/route"
import { POST as importBackup } from "@/app/api/tenant/[tenant]/import/route"

vi.mock("next-auth", () => ({ getServerSession: async () => ({ user: { id: "cms-ci-user", role: "user" } }) }))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/auth", () => ({ authOptions: {} }))
vi.mock("@/lib/tenant-access", () => ({ getTenantAccess: vi.fn() }))
vi.mock("@/lib/rbac", () => ({ checkPermission: async () => ({ allowed: true }), PERMISSIONS: { CONTENT_READ: "content.read" } }))
vi.mock("@/lib/schema-lock", () => ({ assertSchemaEditable: async () => null }))
vi.mock("@/lib/cache", () => ({ invalidatePattern: vi.fn(async () => undefined) }))

function fixtureUrl(value: string | undefined, database: string) {
  if (process.env.SACMS_WORKFLOW_CI !== "1" || !value) throw new Error("Run with the disposable CI databases.")
  const url = new URL(value)
  if (url.hostname !== "127.0.0.1" || url.pathname !== `/${database}`) {
    throw new Error("CMS integration tests require disposable loopback database names.")
  }
  return value
}

fixtureUrl(process.env.DATABASE_URL, "sacms_workflow_ci")
const dedicatedUrl = fixtureUrl(process.env.SACMS_DEDICATED_CI_DATABASE_URL, "sacms_dedicated_ci")
const dedicated = new PrismaClient({ datasources: { db: { url: dedicatedUrl } } })
afterAll(async () => { await Promise.all([db.$disconnect(), dedicated.$disconnect()]) })

function allowWorkspace(tenant: { id: string; name: string; slug: string; plan: string }) {
  vi.mocked(getTenantAccess).mockResolvedValue({ tenantId: tenant.id, userId: "cms-ci-user", role: "owner", tenant })
}

describe("CMS portal and backups against PostgreSQL", () => {
  it("hydrates matching IDs, searches relations and includes the full end date", async () => {
    const tenant = await db.tenant.create({ data: { slug: "cms-search-ci", name: "CMS Search CI", useOwnerInfra: false } })
    allowWorkspace(tenant)
    const contacts = await db.contentType.create({ data: { tenantId: tenant.id, slug: "contacts-ci", name: "Contacts" } })
    const contact = await db.contentEntry.create({
      data: { tenantId: tenant.id, contentTypeId: contacts.id, data: { name: "Relation Needle" } },
    })
    const articles = await db.contentType.create({
      data: {
        tenantId: tenant.id, slug: "articles-ci", name: "Articles",
        schemaFields: { create: [{ slug: "title", name: "Title", type: "text" }, { slug: "contact", name: "Contact", type: "relation", relationSlug: contacts.slug }] },
      },
    })
    const captured = await db.contentEntry.create({
      data: { tenantId: tenant.id, contentTypeId: articles.id, createdAt: new Date("2026-04-15T20:00:00Z"), data: { title: "Fresh Content", contact: [contact.id] } },
    })
    await db.contentEntry.create({
      data: { tenantId: tenant.id, contentTypeId: articles.id, createdAt: new Date("2026-04-16T00:00:00Z"), data: { title: "Later Content", contact: contact.id } },
    })

    const ordinary = await getEntriesAction(tenant.slug, articles.slug, { search: "Fresh Content" })
    expect(ordinary.error).toBeUndefined()
    expect(ordinary.entries?.map(entry => entry.id)).toEqual([captured.id])

    const related = await getEntriesAction(tenant.slug, articles.slug, {
      search: "Relation Needle", searchField: "contact.name", dateTo: "2026-04-15", statuses: ["DRAFT"],
    })
    expect(related.error).toBeUndefined()
    expect(related.entries?.map(entry => entry.id)).toEqual([captured.id])
    expect(related.meta?.pagination.total).toBe(1)

    // The browser sends explicit local-day boundaries as instants.
    const localDay = { dateFrom: "2026-04-16T00:00:00+09:00", dateBefore: "2026-04-16T09:00:00+09:00" }
    const localSearch = await getEntriesAction(tenant.slug, articles.slug, {
      ...localDay, search: "Relation Needle", searchField: "contact.name",
    })
    expect(localSearch.error).toBeUndefined()
    expect(localSearch.entries?.map(entry => entry.id)).toEqual([captured.id])

    const localList = await getEntriesAction(tenant.slug, articles.slug, localDay)
    expect(localList.error).toBeUndefined()
    expect(localList.entries?.map(entry => entry.id)).toEqual([captured.id])
  })

  it("restores a portable backup and its locale to the right databases without duplicating entries", async () => {
    const source = await db.tenant.create({ data: { slug: "cms-backup-source-ci", name: "Source CI", useOwnerInfra: false } })
    const destination = await db.tenant.create({ data: { slug: "cms-backup-result-ci", name: "Result CI", databaseUrl: dedicatedUrl, useOwnerInfra: false } })
    await dedicated.tenant.create({ data: { id: destination.id, slug: destination.slug, name: destination.name } })
    await db.tenantLocale.create({ data: { tenantId: source.id, locale: "id", name: "Indonesia", isDefault: true } })
    const group = await db.contentTypeGroup.create({ data: { tenantId: source.id, name: "Editorial" } })
    const model = await db.contentType.create({ data: { tenantId: source.id, name: "Articles", slug: "backup-articles", groupId: group.id, showInCms: false } })
    const singleton = await db.singleType.create({ data: { tenantId: source.id, name: "Home", slug: "backup-home" } })
    await db.component.create({ data: { tenantId: source.id, name: "SEO", slug: "backup-seo" } })
    const entry = await db.contentEntry.create({
      data: { tenantId: source.id, contentTypeId: model.id, status: "PUBLISHED", publishedAt: new Date("2026-02-12T11:00:00Z"), data: { title: "Published" } },
    })
    await db.tenantSingleTypeAssignment.create({
      data: { tenantId: source.id, singleTypeId: singleton.id, locale: "id", publishedAt: new Date("2026-02-12T11:00:00Z"), data: { featured: entry.id }, draftData: { title: "Draft changes" } },
    })
    await db.media.create({
      data: { tenantId: source.id, name: "cover.png", originalName: "cover.png", mimeType: "image/png", size: 100, url: "/api/media/cover", storageKey: "storage/cover" },
    })

    allowWorkspace(source)
    const response = await exportBackup(new NextRequest(`http://localhost/api/tenant/${source.slug}/export`), { params: Promise.resolve({ tenant: source.slug }) })
    expect(response.status).toBe(200)
    const backup = await response.json()
    expect(backup).toMatchObject({ version: "1.1", manifest: { counts: { locales: 1, contentEntries: 1, media: 1 } } })
    expect(backup.data.media[0]).not.toHaveProperty("storageKey")

    allowWorkspace(destination)
    const restore = async () => {
      const form = new FormData()
      form.set("file", new File([JSON.stringify(backup)], "workspace.json", { type: "application/json" }))
      const result = await importBackup(new NextRequest(`http://localhost/api/tenant/${destination.slug}/import`, { method: "POST", body: form }), { params: Promise.resolve({ tenant: destination.slug }) })
      expect(result.status).toBe(200)
      return result.json()
    }
    expect(await restore()).toMatchObject({
      success: true, partial: true,
      imported: { locales: 1, contentTypes: 1, contentTypeGroups: 1, components: 1, singleTypes: 1, contentEntries: 1, singleTypeData: 1 },
      skipped: [{ section: "media", count: 1 }],
    })
    expect(await restore()).toMatchObject({ success: true, imported: { contentEntries: 1 } })
    expect(await dedicated.contentEntry.count({ where: { tenantId: destination.id } })).toBe(1)
    expect(await db.contentEntry.count({ where: { tenantId: destination.id } })).toBe(0)
    expect(await db.tenantLocale.count({ where: { tenantId: destination.id, isDefault: true } })).toBe(1)
    expect(await dedicated.tenantLocale.count({ where: { tenantId: destination.id } })).toBe(0)

    const restoredEntry = await dedicated.contentEntry.findFirstOrThrow({ where: { tenantId: destination.id } })
    expect(restoredEntry).toMatchObject({ status: "PUBLISHED", publishedAt: entry.publishedAt })
    expect(await dedicated.tenantSingleTypeAssignment.findFirstOrThrow({ where: { tenantId: destination.id } })).toMatchObject({
      data: { featured: restoredEntry.id }, draftData: { title: "Draft changes" },
    })
  })
})
