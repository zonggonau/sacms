import { getTenantDbById } from "@/lib/database"
import { SITE_SETTINGS_SLUG } from "@/lib/content/site-settings-slug"

/**
 * Fixed slug every Website Template, MCP agent, and CMS user can rely on —
 * never something a user/AI picks per-workspace. ensureSiteSettings() only
 * checks this exact slug (not the broader alias list ai-schema-generator.ts
 * uses for its own, differently-shaped safety net) — a starter kit's own
 * identity-ish Single Type under a different slug is left untouched, so at
 * worst this adds a second, guaranteed-shape Single Type alongside it rather
 * than silently skipping provisioning because of a near-miss name match.
 */
export { SITE_SETTINGS_SLUG }

const SITE_SETTINGS_FIELDS: Array<{ name: string; slug: string; type: string; options?: Record<string, unknown> }> = [
  { name: "Nama Brand", slug: "brand-name", type: "text" },
  { name: "Tagline", slug: "tagline", type: "text" },
  { name: "Logo", slug: "logo", type: "media" },
  { name: "Favicon", slug: "favicon", type: "media" },
  {
    name: "Mode Tampilan Default",
    slug: "default-color-mode",
    type: "select",
    options: {
      choices: [
        { label: "Ikuti Perangkat", value: "system" },
        { label: "Terang", value: "light" },
        { label: "Gelap", value: "dark" },
      ],
    },
  },
  { name: "Warna Utama (Terang)", slug: "primary-color-light", type: "color" },
  { name: "Warna Utama (Gelap)", slug: "primary-color-dark", type: "color" },
  { name: "Warna Sekunder (Terang)", slug: "secondary-color-light", type: "color" },
  { name: "Warna Sekunder (Gelap)", slug: "secondary-color-dark", type: "color" },
  { name: "Warna Teks (Terang)", slug: "text-color-light", type: "color" },
  { name: "Warna Teks (Gelap)", slug: "text-color-dark", type: "color" },
]

export const SITE_SETTINGS_SCHEMA = {
  name: "Site Settings",
  slug: SITE_SETTINGS_SLUG,
  description: "Identitas & tema website — logo, favicon, warna brand, dan mode tampilan terang/gelap.",
  fields: SITE_SETTINGS_FIELDS,
}

const DEFAULT_SITE_SETTINGS_DATA = {
  "brand-name": "",
  tagline: "",
  "default-color-mode": "system",
  "primary-color-light": "#1D4ED8",
  "primary-color-dark": "#93C5FD",
  "secondary-color-light": "#475569",
  "secondary-color-dark": "#CBD5E1",
  "text-color-light": "#111827",
  "text-color-dark": "#F8FAFC",
}

/**
 * Guarantees every workspace has a `site-settings` Single Type (brand name,
 * tagline, logo, favicon, default color mode, and primary/secondary/text
 * colors for both light and dark) with one content entry already filled
 * with sane defaults — so a Website Template, an AI agent over MCP (via the
 * existing generic update_single_type_content tool), or the user directly
 * in Content -> Pengaturan Site always has something real to read/edit,
 * never an empty/missing schema.
 *
 * Idempotent and safe to call on every provisioning run: an existing
 * `site-settings` Single Type (and its content) is left completely
 * untouched — this only fills an actual gap, it never resets a workspace's
 * own customization.
 */
/**
 * After a template replaces the schema, site-settings comes back from the template with no content, so the
 * brand name is lost. Put the workspace's name back as brand-name. A brand name that is already set is kept.
 */
export async function restoreSiteSettingsBrandName(
  tenantDb: Awaited<ReturnType<typeof getTenantDbById>>,
  tenantId: string,
  tenantName: string,
): Promise<void> {
  const singleType = await tenantDb.singleType.findFirst({ where: { tenantId, slug: SITE_SETTINGS_SLUG }, select: { id: true } })
  if (!singleType) return
  const where = { tenantId_singleTypeId: { tenantId, singleTypeId: singleType.id } }
  const assignment = await tenantDb.tenantSingleTypeAssignment.findUnique({ where })
  const data = (assignment?.data ?? {}) as Record<string, unknown>
  if (data["brand-name"]) return
  await tenantDb.tenantSingleTypeAssignment.upsert({
    where,
    update: { data: { ...data, "brand-name": tenantName } as any },
    create: {
      tenantId,
      singleTypeId: singleType.id,
      enabled: true,
      publishedAt: new Date(),
      data: { ...DEFAULT_SITE_SETTINGS_DATA, "brand-name": tenantName } as any,
    },
  })
}

export async function ensureSiteSettings(tenantId: string, tenantName: string): Promise<void> {
  const tenantDb = await getTenantDbById(tenantId)

  let singleType = await tenantDb.singleType.findFirst({
    where: { tenantId, slug: SITE_SETTINGS_SLUG },
  })

  if (!singleType) {
    singleType = await tenantDb.singleType.create({
      data: {
        tenantId,
        name: SITE_SETTINGS_SCHEMA.name,
        slug: SITE_SETTINGS_SCHEMA.slug,
        description: SITE_SETTINGS_SCHEMA.description,
        isPublished: true,
        schemaFields: {
          create: SITE_SETTINGS_FIELDS.map((f, idx) => ({
            name: f.name,
            slug: f.slug,
            type: f.type,
            required: false,
            order: idx,
            options: (f.options || {}) as any,
          })),
        },
      },
    })
  }

  await tenantDb.tenantSingleTypeAssignment.upsert({
    where: { tenantId_singleTypeId: { tenantId, singleTypeId: singleType.id } },
    update: {},
    create: {
      tenantId,
      singleTypeId: singleType.id,
      enabled: true,
      publishedAt: new Date(),
      data: { ...DEFAULT_SITE_SETTINGS_DATA, "brand-name": tenantName } as any,
    },
  })
}
