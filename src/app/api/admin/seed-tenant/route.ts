/**
 * POST /api/admin/seed-tenant
 * Seed a tenant with default content types, fields, and sample entries
 */
import { NextResponse } from "next/server"
import { db } from "@/lib/database"
import { withAdminAuth, apiError } from "@/lib/api/route-helpers"

const SEED_SCHEMAS = [
  {
    name: "Pages",
    slug: "pages",
    fields: [
      { name: "title", slug: "title", type: "text", required: true },
      { name: "slug", slug: "slug", type: "slug", required: true },
      { name: "content", slug: "content", type: "richtext" },
      { name: "featured_image", slug: "featured_image", type: "media" },
      { name: "status", slug: "status", type: "select", options: ["Draft", "Published"] },
    ],
    entries: [
      { title: "Tentang Kami", slug: "tentang-kami", content: "<p>Selamat datang di website kami.</p>" },
      { title: "Visi & Misi", slug: "visi-misi", content: "<p>Mewujudkan Papua Digital.</p>" },
    ],
  },
  {
    name: "Berita",
    slug: "berita",
    fields: [
      { name: "judul", slug: "judul", type: "text", required: true },
      { name: "slug", slug: "slug", type: "slug", required: true },
      { name: "konten", slug: "konten", type: "richtext" },
      { name: "kategori", slug: "kategori", type: "select", options: ["Pemerintahan", "UMKM", "Pariwisata"] },
    ],
    entries: [
      { judul: "Transformasi Digital Papua", slug: "transformasi-digital", konten: "<p>Papua memasuki era baru.</p>", kategori: "Teknologi" },
    ],
  },
  {
    name: "Layanan",
    slug: "layanan",
    fields: [
      { name: "nama_layanan", slug: "nama_layanan", type: "text", required: true },
      { name: "deskripsi", slug: "deskripsi", type: "textarea" },
    ],
    entries: [
      { nama_layanan: "Layanan Publik", deskripsi: "Informasi layanan publik." },
      { nama_layanan: "Pengaduan", deskripsi: "Saluran aspirasi masyarakat." },
    ],
  },
]

export const POST = withAdminAuth(async (request) => {
    const body = await request.json()
    const { tenantId } = body
    if (!tenantId) {
      return apiError("validation", { message: "tenantId is required" })
    }

    const tenant = await db.tenant.findUnique({ where: { id: tenantId }, select: { id: true } })
    if (!tenant) return apiError("not_found", { message: "Tenant not found" })

    // Check if already seeded
    const existing = await db.contentType.count({ where: { tenantId } })
    if (existing > 0) {
      return NextResponse.json({ message: "Already seeded", contentTypes: existing })
    }

    let totalEntries = 0

    for (const schema of SEED_SCHEMAS) {
      const ct = await db.contentType.create({
        data: {
          name: schema.name,
          slug: schema.slug,
          tenantId,
          isPublished: true,
          schemaFields: { create: schema.fields },
        },
      })

      for (const entry of schema.entries) {
        await db.contentEntry.create({
          data: {
            status: "PUBLISHED",
            data: entry,
            tenantId,
            contentTypeId: ct.id,
            locale: "id",
          },
        })
        totalEntries++
      }
    }

    return NextResponse.json({
      success: true,
      contentTypes: SEED_SCHEMAS.length,
      entries: totalEntries,
      message: `Seeded ${SEED_SCHEMAS.length} content types with ${totalEntries} sample entries`,
    })
})
