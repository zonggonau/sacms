import { db } from "./database"
import { z } from "zod"
import { generateObject } from "ai"
import { VALID_FIELD_TYPES, type FieldTypeValue, FIELD_TYPES } from "./field-types"

// Re-export for backwards compatibility
export { VALID_FIELD_TYPES, type FieldTypeValue }

const fieldSchema = z.object({
  name: z.string(),
  slug: z.string(),
  type: z.enum(VALID_FIELD_TYPES),
  required: z.boolean().optional().default(false),
  unique: z.boolean().optional().default(false),
  relationSlug: z.string().optional().describe("If type is relation, the slug of the target ContentType"),
  componentSlug: z.string().optional().describe("If type is component, the slug of the target Component"),
})

const modelSchema = z.object({
  name: z.string(),
  slug: z.string(),
  description: z.string().optional(),
  fields: z.array(fieldSchema),
  // Kept for the static heuristic/blueprint fallback data below, which
  // hardcodes a few example records — free, since it isn't AI-generated.
  // The live LLM call never sees this field (see aiModelSchema): nothing
  // downstream (materializeSchemaIntoTenant, the review-step UI) reads
  // dummyData, so asking a real model to generate 2-3 "highly realistic"
  // records per collection was pure wasted output-token spend.
  dummyData: z.array(z.record(z.string(), z.any())).optional()
})

const systemSchema = z.object({
  contentTypes: z.array(modelSchema).describe("Collection types (e.g., Rooms, Products, Facilities, Articles)"),
  singleTypes: z.array(modelSchema).describe("Single types (e.g., HotelSettings, StoreConfig, SiteProfile)"),
  components: z.array(modelSchema).describe("Reusable components (e.g., SEO, Contact, Badge)"),
})

export type GeneratedSystemSchema = z.input<typeof systemSchema>

// Schema actually sent to generateObject for the live LLM call — same shape
// minus dummyData (see the comment on modelSchema above).
const aiModelSchema = z.object({
  name: z.string(),
  slug: z.string(),
  description: z.string().optional(),
  fields: z.array(fieldSchema),
})

const aiSystemSchema = z.object({
  contentTypes: z.array(aiModelSchema).describe("Collection types (e.g., Rooms, Products, Facilities, Articles)"),
  singleTypes: z.array(aiModelSchema).describe("Single types (e.g., HotelSettings, StoreConfig, SiteProfile)"),
  components: z.array(aiModelSchema).describe("Reusable components (e.g., SEO, Contact, Badge)"),
})

const FIELD_TYPE_DOCS = FIELD_TYPES.map(
  (f) => `- ${f.type} (${f.category} - ${f.label}): ${f.description}`
).join("\n")

const SYSTEM_PROMPT = `You are an expert Headless CMS database architect for SaCMS.
Given a user's description of a website they want to build, generate a complete, comprehensive multi-collection database architecture.
Do NOT just generate a single article table. Generate 2 to 4 rich Content Types (e.g. Products/Rooms/Services, Categories, Reviews, Team/Doctors, Bookings), 1 Single Type for global settings, and reusable components.

Use diverse field types strictly from this supported SaCMS list:
${FIELD_TYPE_DOCS}

Field Selection Rules:
- Monetary amounts & prices MUST use 'currency' (e.g. price, fee, rate, budget).
- Discounts, taxes, & percentage values MUST use 'percent'.
- Star reviews (1-5) MUST use 'rating'.
- Single cover/avatar image MUST use 'media'; photo galleries MUST use 'mediaMultiple'; documents/PDFs MUST use 'file'.
- Multi-item badges/sizes/amenities MUST use 'tags' or 'multiselect'.
- Dropdown options MUST use 'select'.
- Comprehensive descriptions & body text MUST use 'richText' (HTML) or 'markdown'.
- Geolocation coordinates & address MUST use 'location'.
- Search engine optimization MUST use 'seo'.
- Related collections MUST use 'relation' with 'relationSlug' matching target ContentType.
- Embedded reusable groups MUST use 'component' with 'componentSlug' matching target Component.

All slugs must be kebab-case lowercase (letters, digits, hyphens only — never underscores), e.g. 'cover-image', 'is-available'.`

async function generateWithAi(prompt: string, tenantId?: string, userId?: string, overrideModel?: string, skipQuotaCheck?: boolean): Promise<GeneratedSystemSchema> {
  const { resolveGatewayModel, enforceAiQuota, recordAiUsage, refundAiQuota, toUsageTotals, withAiRetry } = await import("./ai")

  const config = { tenantId, userId, creditsCost: 5, action: "generate_schema" }
  // Callers that already reserved quota for this cost as part of a larger
  // combined check pass true here so this doesn't check — and potentially
  // pass — a balance that the outer call is also about to spend from
  // before either deduction lands. (No current caller actually does this
  // anymore, but the escape hatch is cheap to keep for whoever needs it.)
  if (!skipQuotaCheck) {
    await enforceAiQuota(config)
  }

  try {
    const { model, modelId } = await resolveGatewayModel(overrideModel)

    // Pass the real zod schema straight to generateObject instead of asking
    // for JSON in the prompt and hand-parsing it — the model's output is
    // validated against aiSystemSchema at generation time, provider-agnostic.
    const result = await withAiRetry(() =>
      generateObject({
        model,
        schema: aiSystemSchema,
        system: SYSTEM_PROMPT,
        prompt,
        maxOutputTokens: 16000,
      })
    )

    await recordAiUsage(config, toUsageTotals(result.usage), modelId, JSON.stringify(result.object))

    return result.object
  } catch (err) {
    if (!skipQuotaCheck) await refundAiQuota(config)
    throw err
  }
}

/**
 * Intelligent Multi-Domain Fallback Heuristic Generator
 */
export function generateHeuristicSchema(prompt: string): GeneratedSystemSchema {
  const p = prompt.toLowerCase()

  // 1. Hotel / Resor / Villa / Penginapan
    // 1. Hotel / Resor / Villa / Penginapan
    if (p.includes("hotel") || p.includes("kamar") || p.includes("resort") || p.includes("penginapan") || p.includes("villa")) {
      return {
        contentTypes: [
          {
            name: "Room",
            slug: "rooms",
            description: "Katalog tipe kamar hotel, tarif malam, dan fasilitas",
            fields: [
              { name: "Judul Kamar", slug: "title", type: "text", required: true },
              { name: "Slug URL", slug: "slug", type: "slug", required: true, unique: true },
              { name: "Sub-judul / Tipe", slug: "subtitle", type: "text", required: true },
              { name: "Tarif per Malam", slug: "price", type: "currency", required: true },
              { name: "Kapasitas Tamu", slug: "capacity", type: "text", required: true },
              { name: "Rating", slug: "rating", type: "rating" },
              { name: "Fasilitas Kamar", slug: "amenities", type: "tags" },
              { name: "Foto Cover", slug: "cover_image", type: "media" },
              { name: "Deskripsi Lengkap", slug: "content", type: "richText" },
              { name: "Tersedia", slug: "is_available", type: "boolean" }
            ],
            dummyData: [
              { title: "Deluxe Ocean Suite Nabire", slug: "deluxe-ocean-suite", subtitle: "Suite Mewah Pemandangan Laut", price: 1250000, capacity: "2 Dewasa", rating: 5, amenities: ["King Bed", "Sea View", "Free WiFi", "Bathtub", "Sarapan"], is_available: true, cover_image: "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1200&q=80", content: "<p>Kamar mewah dengan balkon pribadi menghadap panorama Teluk Cenderawasih yang memukau.</p>" },
              { title: "Executive Family Villa", slug: "executive-family-villa", subtitle: "Villa Privat 2 Lantai", price: 2450000, capacity: "4 Dewasa, 2 Anak", rating: 5, amenities: ["2 King Beds", "Private Jacuzzi", "Living Room", "Kitchenette"], is_available: true, cover_image: "https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=1200&q=80", content: "<p>Villa eksklusif dua lantai cocok untuk liburan keluarga dengan akses privat ke pantai.</p>" }
            ]
          },
          {
            name: "Facility",
            slug: "facilities",
            description: "Fasilitas pendukung hotel dan rekreasi",
            fields: [
              { name: "Judul Fasilitas", slug: "title", type: "text", required: true },
              { name: "Slug URL", slug: "slug", type: "slug", required: true, unique: true },
              { name: "Sub-judul / Kategori", slug: "subtitle", type: "text" },
              { name: "Jam Operasional", slug: "operational_hours", type: "text" },
              { name: "Foto Cover", slug: "cover_image", type: "media" },
              { name: "Deskripsi", slug: "content", type: "richText" }
            ],
            dummyData: [
              { title: "Infinity Pool Oceanfront", slug: "infinity-pool", subtitle: "Rekreasi & Kolam Renang", operational_hours: "06:00 - 21:00", cover_image: "https://images.unsplash.com/photo-1576013551627-0cc20b96c2a7?auto=format&fit=crop&w=1200&q=80", content: "<p>Kolam renang air hangat dengan panorama sunset Teluk Cenderawasih.</p>" },
              { title: "Cenderawasih Seafood Resto", slug: "seafood-resto", subtitle: "Kuliner Khas & Internasional", operational_hours: "07:00 - 23:00", cover_image: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=80", content: "<p>Menyajikan tangkapan laut segar khas Papua dan hidangan mancanegara.</p>" }
            ]
          }
        ],
        singleTypes: [
          {
            name: "Hotel Settings",
            slug: "hotel-settings",
            description: "Profil umum hotel, kontak reservasi, dan banner",
            fields: [
              { name: "Judul Utama (Hero Title)", slug: "hero_title", type: "text", required: true },
              { name: "Sub-judul (Hero Subtitle)", slug: "hero_subtitle", type: "text", required: true },
              { name: "Deskripsi Hotel", slug: "content", type: "richText", required: true },
              { name: "Alamat Lengkap", slug: "address", type: "text", required: true },
              { name: "WhatsApp Reservasi", slug: "whatsapp", type: "text", required: true },
              { name: "Email Informasi", slug: "email", type: "text", required: true }
            ],
            dummyData: [
              {
                hero_title: "Grand Resort & Villas Nabire",
                hero_subtitle: "Kemewahan Tropis di Jantung Teluk Cenderawasih Papua Tengah",
                content: "<p>Resor bintang lima terpadu dengan fasilitas kelas dunia di tepi pantai pasir putih.</p>",
                address: "Jl. Pantai Nabire No. 88, Papua Tengah",
                whatsapp: "+6281234567890",
                email: "reservation@grandresortnabire.com"
              }
            ]
          }
        ],
        components: [
          {
            name: "SEO Meta",
            slug: "seo-meta",
            fields: [
              { name: "Meta Title", slug: "meta_title", type: "text" },
              { name: "Meta Description", slug: "meta_description", type: "textarea" }
            ]
          }
        ]
      }
    }

    // 2. Toko Online / E-Commerce / Produk / Kerajinan
    if (p.includes("toko") || p.includes("store") || p.includes("produk") || p.includes("ecommerce") || p.includes("noken") || p.includes("shop")) {
      return {
        contentTypes: [
          {
            name: "Product",
            slug: "products",
            description: "Katalog produk, harga, dan stok penjualan",
            fields: [
              { name: "Judul Produk", slug: "title", type: "text", required: true },
              { name: "Slug URL", slug: "slug", type: "slug", required: true, unique: true },
              { name: "Sub-judul / Asal", slug: "subtitle", type: "text" },
              { name: "Harga Normal", slug: "price", type: "currency", required: true },
              { name: "Harga Diskon", slug: "sale_price", type: "currency" },
              { name: "Kategori", slug: "category", type: "select" },
              { name: "Rating", slug: "rating", type: "rating" },
              { name: "Stok Tersedia", slug: "stock", type: "number" },
              { name: "Foto Cover", slug: "cover_image", type: "media" },
              { name: "Deskripsi Produk", slug: "content", type: "richText" },
              { name: "Produk Unggulan", slug: "is_featured", type: "boolean" }
            ],
            dummyData: [
              { title: "Noken Asli Kulit Kayu Nabire", slug: "noken-kulit-kayu", subtitle: "Serat Kayu Alami Pegunungan", price: 350000, sale_price: 300000, category: "Kerajinan", rating: 5, stock: 25, is_featured: true, cover_image: "https://images.unsplash.com/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&w=1200&q=80", content: "<p>Noken anyaman tangan dari serat kulit kayu mahkota dewa asli pegunungan Papua Tengah.</p>" },
              { title: "Kopi Arabika Moanemani 250g", slug: "kopi-arabika-moanemani", subtitle: "Single Origin 1.800 mdpl", price: 95000, sale_price: 85000, category: "Kopi Nusantara", rating: 5, stock: 80, is_featured: true, cover_image: "https://images.unsplash.com/photo-1559056199-641a0ac8b55e?auto=format&fit=crop&w=1200&q=80", content: "<p>Kopi arabika organik dari ketinggian 1.800 mdpl Kabupaten Dogiyai dengan aroma buah manis dan body tebal.</p>" }
            ]
          }
        ],
        singleTypes: [
          {
            name: "Store Configuration",
            slug: "store-settings",
            description: "Informasi toko, kontak customer service, dan pengumuman",
            fields: [
              { name: "Judul Utama (Hero Title)", slug: "hero_title", type: "text", required: true },
              { name: "Sub-judul (Hero Subtitle)", slug: "hero_subtitle", type: "text", required: true },
              { name: "Deskripsi Toko", slug: "content", type: "richText", required: true },
              { name: "WhatsApp CS", slug: "whatsapp", type: "text", required: true },
              { name: "Email Toko", slug: "email", type: "text", required: true },
              { name: "Alamat Toko", slug: "address", type: "text", required: true }
            ],
            dummyData: [
              {
                hero_title: "Papua Craft & Coffee Official Store",
                hero_subtitle: "Produk Otentik & Berkualitas Langsung dari Pengrajin Papua",
                content: "<p>Pusat oleh-oleh dan kerajinan tangan khas Papua terlengkap dengan pengiriman ke seluruh Indonesia.</p>",
                whatsapp: "+628114800999",
                email: "cs@papuacraft.id",
                address: "Jl. Jenderal Sudirman No. 25, Nabire, Papua Tengah"
              }
            ]
          }
        ],
        components: []
      }
    }

    // 3. Rumah Sakit / Klinik / Kesehatan
    if (p.includes("klinik") || p.includes("dokter") || p.includes("rumah sakit") || p.includes("health") || p.includes("medis")) {
      return {
        contentTypes: [
          {
            name: "Doctor",
            slug: "doctors",
            description: "Jadwal dan profil dokter spesialis",
            fields: [
              { name: "Nama Dokter", slug: "title", type: "text", required: true },
              { name: "Slug URL", slug: "slug", type: "slug", required: true, unique: true },
              { name: "Sub-judul / Spesialisasi", slug: "subtitle", type: "text", required: true },
              { name: "Rating Pasien", slug: "rating", type: "rating" },
              { name: "Biaya Konsultasi", slug: "price", type: "currency" },
              { name: "Jadwal Praktik", slug: "schedule", type: "text" },
              { name: "Foto Profil", slug: "cover_image", type: "media" },
              { name: "Profil Lengkap", slug: "content", type: "richText" }
            ],
            dummyData: [
              { title: "dr. Hendra Pratama, Sp.PD", slug: "dr-hendra-pratama", subtitle: "Spesialis Penyakit Dalam", rating: 5, price: 250000, schedule: "Senin - Kamis (08:00 - 14:00)", cover_image: "https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&w=1200&q=80", content: "<p>Melayani konsultasi penyakit dalam, diabetes, hipertensi, dan kesehatan metabolik.</p>" }
            ]
          },
          {
            name: "Medical Service",
            slug: "medical-services",
            description: "Layanan kesehatan dan poli klinik",
            fields: [
              { name: "Judul Layanan", slug: "title", type: "text", required: true },
              { name: "Slug URL", slug: "slug", type: "slug", required: true, unique: true },
              { name: "Sub-judul Layanan", slug: "subtitle", type: "text" },
              { name: "Estimasi Biaya", slug: "price", type: "currency" },
              { name: "Foto Cover", slug: "cover_image", type: "media" },
              { name: "Deskripsi", slug: "content", type: "richText" },
              { name: "Tersedia 24 Jam", slug: "is_24_hours", type: "boolean" }
            ],
            dummyData: [
              { title: "Instalasi Gawat Darurat (IGD)", slug: "igd-24-jam", subtitle: "Siaga Darurat Medis 24 Jam", price: 150000, is_24_hours: true, cover_image: "https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&w=1200&q=80", content: "<p>Penanganan darurat medis 24 jam dengan tim dokter dan ambulans siaga.</p>" }
            ]
          }
        ],
        singleTypes: [
          {
            name: "Clinic Settings",
            slug: "clinic-settings",
            description: "Profil klinik dan nomor darurat",
            fields: [
              { name: "Judul Utama (Hero Title)", slug: "hero_title", type: "text", required: true },
              { name: "Sub-judul (Hero Subtitle)", slug: "hero_subtitle", type: "text", required: true },
              { name: "Deskripsi Klinik", slug: "content", type: "richText", required: true },
              { name: "Hotline Darurat / WhatsApp", slug: "whatsapp", type: "text", required: true },
              { name: "Email Informasi", slug: "email", type: "text", required: true },
              { name: "Alamat Klinik", slug: "address", type: "text", required: true }
            ],
            dummyData: [
              {
                hero_title: "Klinik Pratama & Bersalin Nabire Sehat",
                hero_subtitle: "Pelayanan Kesehatan Profesional, Ramah, dan Terpercaya untuk Seluruh Keluarga",
                content: "<p>Menyediakan layanan medis rawat jalan, persalinan 24 jam, apotek terpadu, dan laboratorium modern.</p>",
                whatsapp: "+628114443322",
                email: "info@nabiresehat.com",
                address: "Jl. Yos Sudarso No. 12, Nabire, Papua Tengah"
              }
            ]
          }
        ],
        components: []
      }
    }

    // 4. Default Multi-Collection Business & Portal Architecture
    return {
      contentTypes: [
        {
          name: "Service",
          slug: "services",
          description: "Daftar layanan dan penawaran utama",
          fields: [
            { name: "Judul Layanan", slug: "title", type: "text", required: true },
            { name: "Slug URL", slug: "slug", type: "slug", required: true, unique: true },
            { name: "Sub-judul Layanan", slug: "subtitle", type: "text" },
            { name: "Biaya Mulai Dari", slug: "price", type: "currency" },
            { name: "Rating Klien", slug: "rating", type: "rating" },
            { name: "Foto Cover", slug: "cover_image", type: "media" },
            { name: "Deskripsi Lengkap", slug: "content", type: "richText" },
            { name: "Layanan Unggulan", slug: "is_featured", type: "boolean" }
          ],
          dummyData: [
            { title: "Pengembangan Aplikasi Web Modern", slug: "web-development", subtitle: "Next.js 16, TypeScript & Headless CMS", price: 7500000, rating: 5, is_featured: true, cover_image: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1200&q=80", content: "<p>Solusi web performa tinggi dengan arsitektur multi-tenant dan CMS modern.</p>" },
            { title: "Transformasi Digital & Cloud Infrastruktur", slug: "cloud-infrastructure", subtitle: "Cloud DevOps & Database Architecture", price: 12000000, rating: 5, is_featured: true, cover_image: "https://images.unsplash.com/photo-1544197150-b99a580bb7a8?auto=format&fit=crop&w=1200&q=80", content: "<p>Peningkatan skalabilitas sistem komputasi terdistribusi dan keandalan tinggi.</p>" }
          ]
        },
        {
          name: "Article",
          slug: "articles",
          description: "Wawasan, berita, dan blog",
          fields: [
            { name: "Judul Berita", slug: "title", type: "text", required: true },
            { name: "Slug URL", slug: "slug", type: "slug", required: true, unique: true },
            { name: "Sub-judul / Ringkasan", slug: "subtitle", type: "text", required: true },
            { name: "Kategori", slug: "category", type: "select" },
            { name: "Penulis", slug: "author", type: "text" },
            { name: "Foto Cover", slug: "cover_image", type: "media" },
            { name: "Isi Konten Lengkap", slug: "content", type: "richText" }
          ],
          dummyData: [
            { title: "Peluang Akselerasi Ekonomi Digital 2026", slug: "akselerasi-ekonomi-digital", subtitle: "Bagaimana integrasi AI dan Headless CMS membantu transformasi bisnis", category: "Inovasi", author: "Tim Editor SaCMS", cover_image: "https://images.unsplash.com/photo-1541888946425-d0fbb18086f6?auto=format&fit=crop&w=1200&q=80", content: "<p>Perkembangan platform berbasis cloud memberikan lompatan efisiensi bagi organisasi modern dalam mengelola ekosistem konten digital.</p>" }
          ]
        }
      ],
      singleTypes: [
        {
          name: "Company Profile",
          slug: "company-settings",
          description: "Pengaturan profil perusahaan, slogan, dan kontak resmi",
          fields: [
            { name: "Judul Utama (Hero Title)", slug: "hero_title", type: "text", required: true },
            { name: "Sub-judul (Hero Subtitle)", slug: "hero_subtitle", type: "text", required: true },
            { name: "Deskripsi Perusahaan", slug: "content", type: "richText", required: true },
            { name: "Alamat Kantor", slug: "address", type: "text", required: true },
            { name: "Nomor WhatsApp", slug: "whatsapp", type: "text", required: true },
            { name: "Email Resmi", slug: "email", type: "text", required: true }
          ],
          dummyData: [
            {
              hero_title: "Membangun Masa Depan Digital Anda",
              hero_subtitle: "Solusi kreatif dan teknologi terdepan untuk mengembangkan skala bisnis Anda ke level berikutnya.",
              content: "<p>Kami adalah studio agensi kreatif yang mengkhususkan diri pada pengembangan website modern, desain UI/UX, dan strategi branding terpadu.</p>",
              address: "Gedung Cyber One, Lantai 5, Jakarta Selatan",
              whatsapp: "+6281299887766",
              email: "hello@contentflow.io"
            }
          ]
        }
      ],
      components: [
        {
          name: "SEO Meta",
          slug: "seo-meta",
          fields: [
            { name: "Meta Title", slug: "meta_title", type: "text" },
            { name: "Meta Description", slug: "meta_description", type: "textarea" }
          ]
        }
      ]
    }
}

/**
 * The save endpoint (POST .../ai-builder/import-schema) enforces the exact
 * same kebab-case-only slug rule a human hits creating a Content Type by
 * hand (see createContentTypeSchema in lib/validations/admin.ts): letters,
 * digits, hyphens — no underscores. The system prompt above tells the model
 * "snake_case or kebab-case", and every hardcoded fallback/blueprint schema
 * below and in ai/domain-knowledge-types.ts uses snake_case slugs — so a
 * schema that previews fine routinely 400s on save. Normalizing every slug
 * (model-level and field-level, including relationSlug/componentSlug
 * references, with the same function so cross-references still match) right
 * before it's returned closes this for all three paths — real AI, blueprint
 * match, and heuristic fallback — without touching the platform-wide rule.
 */
function toKebabSlug(input: string): string {
  const slug = input.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
  return slug || "field"
}

function normalizeSchemaSlugs(schema: GeneratedSystemSchema): GeneratedSystemSchema {
  type Model = GeneratedSystemSchema["contentTypes"][number]
  const normalizeModel = (model: Model): Model => ({
    ...model,
    slug: toKebabSlug(model.slug),
    fields: (model.fields || []).map((field) => ({
      ...field,
      slug: toKebabSlug(field.slug),
      ...(field.relationSlug ? { relationSlug: toKebabSlug(field.relationSlug) } : {}),
      ...(field.componentSlug ? { componentSlug: toKebabSlug(field.componentSlug) } : {}),
    })),
  })

  return {
    contentTypes: (schema.contentTypes || []).map(normalizeModel),
    singleTypes: (schema.singleTypes || []).map(normalizeModel),
    components: (schema.components || []).map(normalizeModel),
  }
}

export interface GenerateSystemSchemaResult {
  schema: GeneratedSystemSchema
  /** True if the real LLM call failed/was unavailable and a canned blueprint or heuristic was used instead. */
  usedFallback: boolean
  /** The error that triggered the fallback — surfaced to the admin instead of silently swallowed. */
  fallbackReason?: string
}

export async function generateSystemSchema(prompt: string, tenantId?: string, userId?: string, model?: string, skipQuotaCheck?: boolean): Promise<GenerateSystemSchemaResult> {
  // 1. Coba AI LLM via Vercel AI Gateway
  try {
    console.log("[AI Schema] Analyzing user prompt with LLM to generate custom dynamic schema...")
    const schema = await generateWithAi(prompt, tenantId, userId, model, skipQuotaCheck)
    return { schema: normalizeSchemaSlugs(schema), usedFallback: false }
  } catch (error: any) {
    // enforceAiQuota (src/lib/ai.ts) throws this with .status === 429 when
    // the user/tenant is simply out of AI credits — not a Gateway/infra
    // problem. Silently handing back a free fallback schema here would
    // misreport an actionable "top up your credits" state as "AI Gateway
    // tidak merespons" (the fallback UI's message), and would let a
    // depleted account keep generating unlimited free mock schemas.
    // Re-throw so the route's handleRouteError surfaces the real 429 and
    // message instead.
    if (error?.status === 429) throw error

    console.warn("[AI Schema] AI generation failed or not configured:", error.message)
    const fallbackReason = error?.message || "AI generation gagal tanpa pesan error"

    // 2. Intelligent Blueprint Matcher: cek apakah prompt cocok dengan koleksi blueprint kaya di DOMAIN_KNOWLEDGE_LIBRARY
    try {
      const { DOMAIN_KNOWLEDGE_LIBRARY } = await import("./ai/domain-knowledge-types")
      const p = prompt.toLowerCase()
      const matched = DOMAIN_KNOWLEDGE_LIBRARY.find(bp => {
        const words = bp.name.toLowerCase().split(/\s+/).concat(bp.category.toLowerCase().split(/\s+/))
        return words.some(w => w.length > 3 && p.includes(w))
      })
      if (matched) {
        console.log(`[AI Schema] Matched domain knowledge blueprint: ${matched.name}`)
        return {
          schema: normalizeSchemaSlugs({
            contentTypes: matched.schema.contentTypes as any,
            singleTypes: matched.schema.singleTypes as any,
            components: (matched.schema.components || []) as any,
          }),
          usedFallback: true,
          fallbackReason,
        }
      }
    } catch (bpErr) {
      console.warn("[AI Schema] Blueprint matcher error:", bpErr)
    }

    // 3. Fallback Heuristic Generator Terstruktur
    console.log("[AI Schema] Using High-Accuracy Multi-Collection Domain Synthesizer...")
    return { schema: normalizeSchemaSlugs(generateHeuristicSchema(prompt)), usedFallback: true, fallbackReason }
  }
}
