import "server-only"

import type { PrismaClient } from "../../../prisma/generated-client"

type SchemaFieldLike = { name: string; slug: string; type: string; relationSlug: string | null }
type ModelLike = { name: string; slug: string; description: string | null; schemaFields: SchemaFieldLike[] }

function describeFields(fields: SchemaFieldLike[]): string {
  if (fields.length === 0) return "(belum ada field)"
  return fields
    .map((f) => (f.type === "relation" && f.relationSlug ? `${f.name} (relasi ke ${f.relationSlug})` : f.name))
    .join(", ")
}

function describeModel(model: ModelLike): string {
  const desc = model.description ? ` — ${model.description}` : ""
  return `- **${model.name}** (${model.slug})${desc}: ${describeFields(model.schemaFields)}`
}

/**
 * Turns a tenant's already-finalized CMS schema into a ready-to-submit AI
 * Site brief, so the user doesn't have to re-describe in prose a structure
 * they just finished designing in the Schema Builder. Still plain editable
 * text in the landing textarea afterward — this is a strong starting draft,
 * not a locked instruction.
 */
export async function buildAiSitePromptFromSchema(tenantDb: PrismaClient, tenantId: string): Promise<string> {
  const [contentTypes, singleTypes, components] = await Promise.all([
    tenantDb.contentType.findMany({
      where: { tenantId },
      include: { schemaFields: { orderBy: { order: "asc" } } },
    }),
    tenantDb.singleType.findMany({
      where: { tenantId },
      include: { schemaFields: { orderBy: { order: "asc" } } },
    }),
    tenantDb.component.findMany({
      where: { tenantId },
      include: { schemaFields: { orderBy: { order: "asc" } } },
    }),
  ])

  const sections: string[] = [
    "Bangun frontend Next.js yang modern, responsif, dan rapi untuk website ini, sesuai skema CMS yang sudah difinalkan di bawah. Ambil semua data nyata lewat SaCMS SDK (lib/sacms.ts) — jangan ada teks atau gambar placeholder di bagian yang seharusnya terisi data dari CMS.",
  ]

  if (singleTypes.length > 0) {
    sections.push(
      [
        "**Single Type (halaman/setting tunggal):**",
        ...singleTypes.map(describeModel),
      ].join("\n"),
    )
  }

  if (contentTypes.length > 0) {
    sections.push(
      [
        "**Content Type (koleksi berulang):**",
        ...contentTypes.map(describeModel),
      ].join("\n"),
    )
  }

  if (components.length > 0) {
    sections.push(
      [
        "**Component (grup field yang dipakai berulang di dalam type lain):**",
        ...components.map(describeModel),
      ].join("\n"),
    )
  }

  sections.push(
    "Bangun header dan footer dari Single Type setting global di atas (logo, warna brand, link navigasi, link footer, kontak) jika ada. Setiap halaman publik pakai field 'seo'-nya untuk meta tag. Rancang tampilan yang relevan dengan konten ini — jangan generik.",
  )

  return sections.join("\n\n")
}
