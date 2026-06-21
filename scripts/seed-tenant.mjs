#!/usr/bin/env node
/**
 * SaCMS Self-Hosted Tenant Seed Script
 *
 * Seeds default content types, fields, and sample entries
 * for a newly created workspace/tenant.
 *
 * Usage:
 *   node scripts/seed-tenant.mjs <tenantId>
 *
 * Or via API:
 *   POST /api/admin/seed-tenant
 *   Body: { tenantId: "..." }
 */

const { PrismaClient } = require('/root/.openclaw/workspace/sacms/prisma/generated-client/index.js');
const db = new PrismaClient();

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
      { title: "Tentang Kami", slug: "tentang-kami", content: "<p>Selamat datang di website kami. Kami hadir untuk melayani masyarakat Papua dalam transformasi digital.</p>" },
      { title: "Visi & Misi", slug: "visi-misi", content: "<p>Visi kami adalah mewujudkan Papua Digital. Misi kami adalah membawa teknologi informasi ke seluruh pelosok Papua.</p>" },
      { title: "Hubungi Kami", slug: "hubungi-kami", content: "<p>Silakan hubungi kami untuk informasi lebih lanjut.</p>" },
    ],
  },
  {
    name: "Berita",
    slug: "berita",
    fields: [
      { name: "judul", slug: "judul", type: "text", required: true },
      { name: "slug", slug: "slug", type: "slug", required: true },
      { name: "konten", slug: "konten", type: "richtext" },
      { name: "gambar", slug: "gambar", type: "media" },
      { name: "penulis", slug: "penulis", type: "text" },
      { name: "tanggal", slug: "tanggal", type: "date" },
      { name: "kategori", slug: "kategori", type: "select", options: ["Pemerintahan", "UMKM", "Pariwisata", "Teknologi"] },
    ],
    entries: [
      { judul: "Transformasi Digital Papua Dimulai", slug: "transformasi-digital-papua", konten: "<p>Papua memasuki era baru transformasi digital dengan hadirnya platform digital yang memudahkan pemerintah dan masyarakat.</p>", kategori: "Teknologi" },
      { judul: "UMKM Papua Go Digital", slug: "umkm-papua-go-digital", konten: "<p>Semakin banyak UMKM di Papua yang beralih ke platform digital untuk memasarkan produk lokal mereka.</p>", kategori: "UMKM" },
    ],
  },
  {
    name: "Layanan",
    slug: "layanan",
    fields: [
      { name: "nama_layanan", slug: "nama_layanan", type: "text", required: true },
      { name: "deskripsi", slug: "deskripsi", type: "textarea" },
      { name: "ikon", slug: "ikon", type: "text" },
    ],
    entries: [
      { nama_layanan: "Layanan Publik", deskripsi: "Informasi dan akses layanan publik bagi masyarakat Papua.", ikon: "Shield" },
      { nama_layanan: "Informasi Desa", deskripsi: "Portal informasi untuk desa dan kelurahan di Papua.", ikon: "Map" },
      { nama_layanan: "Pengaduan", deskripsi: "Saluran pengaduan dan aspirasi masyarakat.", ikon: "MessageSquare" },
    ],
  },
  {
    name: "Galeri",
    slug: "galeri",
    fields: [
      { name: "judul", slug: "judul", type: "text", required: true },
      { name: "gambar", slug: "gambar", type: "media", required: true },
      { name: "deskripsi", slug: "deskripsi", type: "textarea" },
    ],
    entries: [],
  },
];

const SEED_SINGLE_TYPES = [
  {
    name: "Profil",
    slug: "profil",
    fields: [
      { name: "nama_instansi", slug: "nama_instansi", type: "text", required: true },
      { name: "deskripsi", slug: "deskripsi", type: "richtext" },
      { name: "alamat", slug: "alamat", type: "textarea" },
      { name: "telepon", slug: "telepon", type: "text" },
      { name: "email", slug: "email", type: "text" },
      { name: "logo", slug: "logo", type: "media" },
    ],
  },
  {
    name: "Kontak",
    slug: "kontak",
    fields: [
      { name: "email_utama", slug: "email_utama", type: "text" },
      { name: "nomor_whatsapp", slug: "nomor_whatsapp", type: "text" },
      { name: "alamat_kantor", slug: "alamat_kantor", type: "textarea" },
      { name: "jam_kerja", slug: "jam_kerja", type: "text" },
      { name: "maps_embed", slug: "maps_embed", type: "textarea" },
    ],
  },
];

async function seedTenant(tenantId) {
  console.log(`🌱 Seeding tenant: ${tenantId}`);
  const startedAt = Date.now();

  try {
    // Verify tenant exists
    const tenant = await db.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) {
      console.error(`❌ Tenant not found: ${tenantId}`);
      return { success: false, error: "Tenant not found" };
    }
    console.log(`  ✅ Found tenant: ${tenant.name} (${tenant.slug})`);

    // Check if already seeded
    const existingCTs = await db.contentType.count({ where: { tenantId } });
    if (existingCTs > 0) {
      console.log(`  ⏭️ Tenant already has ${existingCTs} content types — skipping seed`);
      return { success: true, skipped: true, reason: "Already seeded" };
    }

    // Create Content Types + Fields + Sample Entries
    for (const schema of SEED_SCHEMAS) {
      console.log(`  📦 Creating content type: ${schema.name}`);
      const ct = await db.contentType.create({
        data: {
          name: schema.name,
          slug: schema.slug,
          tenantId,
          isPublished: true,
          schemaFields: {
            create: schema.fields.map((f) => ({
              name: f.name,
              slug: f.slug,
              type: f.type,
              required: f.required || false,
              options: f.options || null,
            })),
          },
        },
      });

      // Create sample entries
      for (const entry of schema.entries) {
        await db.contentEntry.create({
          data: {
            status: "PUBLISHED",
            data: entry,
            tenantId,
            contentTypeId: ct.id,
            locale: "id",
          },
        });
        console.log(`    📝 Entry: ${entry.title || entry.judul || "untitled"}`);
      }
    }

    // Create Single Types
    for (const st of SEED_SINGLE_TYPES) {
      console.log(`  📄 Creating single type: ${st.name}`);
      const singleType = await db.singleType.create({
        data: {
          name: st.name,
          slug: st.slug,
          tenantId,
          isPublished: true,
          schemaFields: {
            create: st.fields.map((f) => ({
              name: f.name,
              slug: f.slug,
              type: f.type,
              required: f.required || false,
            })),
          },
        },
      });

      // Create empty entry
      await db.contentEntry.create({
        data: {
          status: "DRAFT",
          data: {},
          tenantId,
          singleTypeId: singleType.id,
          locale: "id",
        },
      });
    }

    const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
    console.log(`\n✅ Seed complete (${elapsed}s)`);
    console.log(`  📋 Content Types: ${SEED_SCHEMAS.length}`);
    const totalEntries = SEED_SCHEMAS.reduce((sum, s) => sum + s.entries.length, 0);
    console.log(`  📝 Sample Entries: ${totalEntries}`);
    console.log(`  📄 Single Types: ${SEED_SINGLE_TYPES.length}`);

    return { success: true, contentTypes: SEED_SCHEMAS.length, entries: totalEntries };

  } catch (err) {
    console.error("❌ Seed failed:", err);
    return { success: false, error: err.message };
  } finally {
    await db.$disconnect();
  }
}

// CLI mode
const tenantId = process.argv[2];
if (tenantId) {
  seedTenant(tenantId).then((result) => {
    if (!result.success) process.exit(1);
  });
} else {
  console.log("Usage: node scripts/seed-tenant.mjs <tenantId>");
  console.log("Or call POST /api/admin/seed-tenant with { tenantId }");
}

module.exports = { seedTenant, SEED_SCHEMAS, SEED_SINGLE_TYPES };
