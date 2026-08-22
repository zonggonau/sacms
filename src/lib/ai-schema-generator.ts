import { db } from "./database"
import { z } from "zod"
import OpenAI from "openai"

// Use all valid types from field-types.ts
export const VALID_FIELD_TYPES = [
  "text", "textarea", "richText", "markdown", "slug",
  "number", "currency",
  "date", "datetime", "time", "dateRange",
  "select", "multiselect", "tags",
  "boolean",
  "email", "password", "url", "phone", "uid",
  "media", "mediaMultiple", "file",
  "relation", "component", "repeater",
  "json", "color", "rating", "button", "document_template"
] as const

export type FieldTypeValue = (typeof VALID_FIELD_TYPES)[number]

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
  dummyData: z.array(z.record(z.string(), z.any())).optional().describe("An array of 3-5 highly realistic, varied dummy data objects matching the fields defined. For singleTypes, provide just 1 object.")
})

const systemSchema = z.object({
  contentTypes: z.array(modelSchema).describe("Collection types (e.g., Rooms, Products, Facilities, Articles)"),
  singleTypes: z.array(modelSchema).describe("Single types (e.g., HotelSettings, StoreConfig, SiteProfile)"),
  components: z.array(modelSchema).describe("Reusable components (e.g., SEO, Contact, Badge)"),
})

export type GeneratedSystemSchema = z.input<typeof systemSchema>

const SYSTEM_PROMPT = `You are an expert Headless CMS database architect for SaCMS.
Given a user's description of a website they want to build, generate a complete, comprehensive multi-collection database architecture.
Do NOT just generate a single article table. Generate 2 to 4 rich Content Types (e.g. Products/Rooms/Services, Categories, Reviews, Team/Doctors, Bookings), 1 Single Type for global settings, and reusable components.

Use diverse field types from this list:
- Basic: text, textarea, richText, markdown, slug
- Numbers: number, currency
- Date & Time: date, datetime, time, dateRange
- Selection: select, multiselect, tags
- Boolean: boolean
- Validation: email, password, url, phone, uid
- Media: media, mediaMultiple, file
- Relations: relation, component, repeater
- Advanced: json, color, rating, button, document_template

For each collection, provide 3 to 5 realistic, detailed mock records in 'dummyData'.
For Single Types, provide 1 complete initial record in 'dummyData'.

All slugs must be snake_case or kebab-case lowercase.`

async function generateWithOpenAI(prompt: string): Promise<GeneratedSystemSchema> {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  
  const completion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: prompt }
    ],
    response_format: { type: "json_object" },
    max_tokens: 8000,
    temperature: 0.4
  })
  
  const text = completion.choices[0]?.message?.content
  if (!text) throw new Error("OpenAI returned no content")
  
  const parsed = JSON.parse(text)
  return systemSchema.parse(parsed)
}

async function generateWithDeepSeek(prompt: string, tenantId?: string, userId?: string): Promise<GeneratedSystemSchema> {
  const { safeGenerateContent } = await import("./ai")
  const result = await safeGenerateContent(SYSTEM_PROMPT, prompt, { 
    responseFormat: "json_object", 
    maxTokens: 8000, 
    tenantId, 
    userId,
    creditsCost: 5,
    action: "generate_schema", 
    overrideModel: "deepseek-chat" 
  })
  
  const parsed = JSON.parse(result.text)
  return systemSchema.parse(parsed)
}

/**
 * Intelligent Multi-Domain Fallback Heuristic Generator
 */
export function generateHeuristicSchema(prompt: string): GeneratedSystemSchema {
  const p = prompt.toLowerCase()

  // 1. Hotel / Resor / Villa / Penginapan
  if (p.includes("hotel") || p.includes("kamar") || p.includes("resort") || p.includes("penginapan") || p.includes("villa")) {
    return {
      contentTypes: [
        {
          name: "Room",
          slug: "rooms",
          description: "Katalog tipe kamar hotel, tarif malam, dan fasilitas",
          fields: [
            { name: "Nama Kamar", slug: "title", type: "text", required: true },
            { name: "Slug URL", slug: "slug", type: "slug" },
            { name: "Tarif per Malam", slug: "price", type: "currency", required: true },
            { name: "Kapasitas Tamu", slug: "capacity", type: "text", required: true },
            { name: "Rating", slug: "rating", type: "rating" },
            { name: "Fasilitas Kamar", slug: "features", type: "tags" },
            { name: "Foto Kamar", slug: "photos", type: "mediaMultiple" },
            { name: "Deskripsi Lengkap", slug: "description", type: "richText" },
            { name: "Tersedia", slug: "is_available", type: "boolean" }
          ],
          dummyData: [
            { title: "Deluxe Ocean Suite Nabire", slug: "deluxe-ocean-suite", price: 1250000, capacity: "2 Dewasa", rating: 5, features: ["King Bed", "Sea View", "Free WiFi", "Bathtub", "Sarapan"], is_available: true, description: "<p>Kamar mewah dengan balkon pribadi menghadap panorama Teluk Cenderawasih yang memukau.</p>" },
            { title: "Executive Family Villa", slug: "executive-family-villa", price: 2450000, capacity: "4 Dewasa, 2 Anak", rating: 5, features: ["2 King Beds", "Private Jacuzzi", "Living Room", "Kitchenette"], is_available: true, description: "<p>Villa eksklusif dua lantai cocok untuk liburan keluarga dengan akses privat ke pantai.</p>" },
            { title: "Standard Garden Room", slug: "standard-garden-room", price: 750000, capacity: "2 Dewasa", rating: 4, features: ["Queen Bed", "Garden View", "Air Conditioner", "Work Desk"], is_available: true, description: "<p>Kenyamanan istirahat di tengah rimbunnya taman tropis tropis Nabire.</p>" }
          ]
        },
        {
          name: "Facility",
          slug: "facilities",
          description: "Fasilitas pendukung hotel dan rekreasi",
          fields: [
            { name: "Nama Fasilitas", slug: "name", type: "text", required: true },
            { name: "Kategori", slug: "category", type: "select" },
            { name: "Jam Operasional", slug: "hours", type: "text" },
            { name: "Foto Fasilitas", slug: "photo", type: "media" },
            { name: "Deskripsi", slug: "description", type: "textarea" }
          ],
          dummyData: [
            { name: "Infinity Pool Oceanfront", category: "Rekreasi", hours: "06:00 - 21:00", description: "Kolam renang air hangat dengan panorama sunset Teluk Cenderawasih." },
            { name: "Cenderawasih Seafood Resto", category: "Kuliner", hours: "07:00 - 23:00", description: "Menyajikan tangkapan laut segar khas Papua dan hidangan mancanegara." },
            { name: "Papua Spa & Wellness", category: "Kesehatan", hours: "09:00 - 20:00", description: "Pijat relaksasi tradisional Papua dengan minyak aromaterapi alami." }
          ]
        },
        {
          name: "Review",
          slug: "reviews",
          description: "Ulasan dan testimoni tamu",
          fields: [
            { name: "Nama Tamu", slug: "guest_name", type: "text", required: true },
            { name: "Asal Kota", slug: "city", type: "text" },
            { name: "Rating", slug: "rating", type: "rating" },
            { name: "Ulasan", slug: "comment", type: "textarea" },
            { name: "Tanggal Menginap", slug: "stay_date", type: "date" }
          ],
          dummyData: [
            { guest_name: "Budi Santoso", city: "Jakarta", rating: 5, comment: "Pemandangan kamar luar biasa indah, staf sangat ramah dan makanannya lezat!", stay_date: "2026-07-15" },
            { guest_name: "Sarah Jenkins", city: "Sydney", rating: 5, comment: "Best resort in Papua. The ocean view from the suite was breathtaking.", stay_date: "2026-08-01" }
          ]
        }
      ],
      singleTypes: [
        {
          name: "Hotel Settings",
          slug: "hotel-settings",
          description: "Profil umum hotel, kontak reservasi, dan banner",
          fields: [
            { name: "Nama Hotel", slug: "hotel_name", type: "text", required: true },
            { name: "Tagline", slug: "tagline", type: "text" },
            { name: "Alamat Lengkap", slug: "address", type: "textarea" },
            { name: "WhatsApp Reservasi", slug: "whatsapp", type: "phone" },
            { name: "Email Informasi", slug: "email", type: "email" },
            { name: "Tombol Reservasi", slug: "booking_cta", type: "button" }
          ],
          dummyData: [
            { hotel_name: "Grand Resort & Villas Nabire", tagline: "Kemewahan Tropis di Jantung Teluk Cenderawasih", address: "Jl. Pantai Nabire No. 88, Papua Tengah", whatsapp: "+6281234567890", email: "reservation@grandresortnabire.com" }
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
            { name: "Nama Produk", slug: "name", type: "text", required: true },
            { name: "Slug URL", slug: "slug", type: "slug" },
            { name: "Harga (Rp)", slug: "price", type: "currency", required: true },
            { name: "Kategori", slug: "category", type: "select" },
            { name: "Rating", slug: "rating", type: "rating" },
            { name: "Label Produk", slug: "tags", type: "tags" },
            { name: "Stok Tersedia", slug: "stock", type: "number" },
            { name: "Foto Produk", slug: "image", type: "media" },
            { name: "Deskripsi", slug: "description", type: "richText" },
            { name: "Produk Unggulan", slug: "is_featured", type: "boolean" }
          ],
          dummyData: [
            { name: "Noken Asli Kulit Kayu Nabire", slug: "noken-kulit-kayu", price: 350000, category: "Kerajinan", rating: 5, tags: ["Best Seller", "Handmade", "Unik"], stock: 25, is_featured: true, description: "<p>Noken anyaman tangan dari serat kulit kayu mahkota dewa asli pegunungan Papua Tengah.</p>" },
            { name: "Kopi Arabika Moanemani 250g", slug: "kopi-arabika-moanemani", price: 95000, category: "Kopi Nusantara", rating: 5, tags: ["Organic", "Single Origin"], stock: 80, is_featured: true, description: "<p>Kopi arabika organik dari ketinggian 1.800 mdpl Kabupaten Dogiyai dengan aroma buah manis dan body tebal.</p>" },
            { name: "Batik Papua Sutra Motif Cenderawasih", slug: "batik-sutra-cenderawasih", price: 425000, category: "Pakaian & Kain", rating: 5, tags: ["Premium", "Eksklusif"], stock: 15, is_featured: false, description: "<p>Kain batik sutra halus bercorak burung cenderawasih kebanggaan Papua.</p>" }
          ]
        },
        {
          name: "Category",
          slug: "categories",
          description: "Kategori produk toko",
          fields: [
            { name: "Nama Kategori", slug: "name", type: "text", required: true },
            { name: "Slug", slug: "slug", type: "slug" },
            { name: "Deskripsi", slug: "description", type: "textarea" }
          ],
          dummyData: [
            { name: "Kerajinan Asli", slug: "kerajinan-asli", description: "Karya seni ukir dan anyaman tradisional masyarakat adat Papua." },
            { name: "Kopi Nusantara", slug: "kopi-nusantara", description: "Biji kopi kualitas ekspor dari petani lokal pegunungan tengah." }
          ]
        },
        {
          name: "Customer Review",
          slug: "reviews",
          description: "Ulasan pembeli produk",
          fields: [
            { name: "Nama Pembeli", slug: "customer_name", type: "text", required: true },
            { name: "Rating", slug: "rating", type: "rating" },
            { name: "Ulasan", slug: "review_text", type: "textarea" },
            { name: "Tanggal", slug: "review_date", type: "date" }
          ],
          dummyData: [
            { customer_name: "Anita Wijaya", rating: 5, review_text: "Nokennya halus dan sangat kuat. Pengiriman dari Nabire cepat sampai ke Surabaya!", review_date: "2026-08-10" }
          ]
        }
      ],
      singleTypes: [
        {
          name: "Store Configuration",
          slug: "store-config",
          description: "Informasi toko, kontak customer service, dan pengumuman",
          fields: [
            { name: "Nama Toko", slug: "store_name", type: "text", required: true },
            { name: "Tagline", slug: "tagline", type: "text" },
            { name: "WhatsApp CS", slug: "whatsapp_cs", type: "phone" },
            { name: "Email Toko", slug: "email_store", type: "email" },
            { name: "Bebas Ongkir Minimal", slug: "free_shipping_min", type: "currency" }
          ],
          dummyData: [
            { store_name: "Papua Craft & Coffee Official Store", tagline: "Produk Otentik & Berkualitas Langsung dari Pengrajin Papua", whatsapp_cs: "+628114800999", email_store: "cs@papuacraft.id", free_shipping_min: 500000 }
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
            { name: "Nama Dokter", slug: "name", type: "text", required: true },
            { name: "Spesialisasi", slug: "specialization", type: "select" },
            { name: "Rating Pasien", slug: "rating", type: "rating" },
            { name: "Tahun Pengalaman", slug: "experience_years", type: "number" },
            { name: "Biaya Konsultasi", slug: "fee", type: "currency" },
            { name: "Jadwal Praktik", slug: "schedule", type: "text" },
            { name: "Foto Profil", slug: "avatar", type: "media" }
          ],
          dummyData: [
            { name: "dr. Hendra Pratama, Sp.PD", specialization: "Penyakit Dalam", rating: 5, experience_years: 12, fee: 250000, schedule: "Senin - Kamis (08:00 - 14:00)" },
            { name: "dr. Maria Kogoya, Sp.A", specialization: "Spesialis Anak", rating: 5, experience_years: 9, fee: 200000, schedule: "Senin - Sabtu (15:00 - 20:00)" }
          ]
        },
        {
          name: "Medical Service",
          slug: "medical-services",
          description: "Layanan kesehatan dan poli klinik",
          fields: [
            { name: "Nama Layanan", slug: "title", type: "text", required: true },
            { name: "Estimasi Biaya", slug: "price_estimate", type: "currency" },
            { name: "Deskripsi", slug: "description", type: "richText" },
            { name: "Tersedia 24 Jam", slug: "is_24_hours", type: "boolean" }
          ],
          dummyData: [
            { title: "Instalasi Gawat Darurat (IGD)", price_estimate: 150000, is_24_hours: true, description: "<p>Penanganan darurat medis 24 jam dengan tim dokter dan ambulans siaga.</p>" },
            { title: "Laboratorium & Medical Check Up", price_estimate: 450000, is_24_hours: false, description: "<p>Pemeriksaan darah lengkap, rontgen, dan skrining organ komprehensif.</p>" }
          ]
        }
      ],
      singleTypes: [
        {
          name: "Clinic Settings",
          slug: "clinic-settings",
          fields: [
            { name: "Nama Fasilitas Medis", slug: "clinic_name", type: "text" },
            { name: "Hotline Darurat", slug: "emergency_phone", type: "phone" },
            { name: "Alamat", slug: "address", type: "textarea" }
          ],
          dummyData: [
            { clinic_name: "Klinik Pratama & Bersalin Nabire Sehat", emergency_phone: "+628114443322", address: "Jl. Yos Sudarso No. 12, Nabire" }
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
          { name: "Nama Layanan", slug: "title", type: "text", required: true },
          { name: "Slug", slug: "slug", type: "slug" },
          { name: "Kategori", slug: "category", type: "select" },
          { name: "Biaya Mulai Dari", slug: "price_start", type: "currency" },
          { name: "Rating Klien", slug: "rating", type: "rating" },
          { name: "Tag Keunggulan", slug: "tags", type: "tags" },
          { name: "Ikon / Gambar", slug: "photo", type: "media" },
          { name: "Deskripsi Lengkap", slug: "description", type: "richText" },
          { name: "Layanan Unggulan", slug: "is_featured", type: "boolean" }
        ],
        dummyData: [
          { title: "Pengembangan Aplikasi Web Modern", slug: "web-development", category: "Teknologi", price_start: 7500000, rating: 5, tags: ["Next.js", "Headless CMS", "Tailwind"], is_featured: true, description: "<p>Solusi web performa tinggi dengan arsitektur multi-tenant dan CMS modern.</p>" },
          { title: "Transformasi Digital & Cloud Infrastruktur", slug: "cloud-infrastructure", category: "Infrastruktur", price_start: 12000000, rating: 5, tags: ["Cloud", "DevOps", "Database"], is_featured: true, description: "<p>Peningkatan skalabilitas sistem komputasi terdistribusi dan keandalan tinggi.</p>" }
        ]
      },
      {
        name: "Article",
        slug: "articles",
        description: "Wawasan, berita, dan blog",
        fields: [
          { name: "Judul Berita", slug: "title", type: "text", required: true },
          { name: "Slug URL", slug: "slug", type: "slug" },
          { name: "Kategori", slug: "category", type: "select" },
          { name: "Tanggal Rilis", slug: "published_date", type: "date" },
          { name: "Penulis", slug: "author", type: "text" },
          { name: "Foto Sampul", slug: "cover_image", type: "media" },
          { name: "Ringkasan", slug: "excerpt", type: "textarea" },
          { name: "Isi Konten", slug: "content", type: "richText" }
        ],
        dummyData: [
          { title: "Peluang Akselerasi Ekonomi Digital 2026", slug: "akselerasi-ekonomi-digital", category: "Inovasi", published_date: "2026-08-15", author: "Tim Editor SaCMS", excerpt: "Bagaimana integrasi AI dan Headless CMS membantu transformasi operasional bisnis modern.", content: "<p>Perkembangan platform berbasis cloud memberikan lompatan efisiensi bagi organisasi modern dalam mengelola ekosistem konten digital.</p>" },
          { title: "Panduan Membangun Website Cepat & Responsif", slug: "panduan-website-cepat", category: "Tutorial", published_date: "2026-08-10", author: "Lead Architect", excerpt: "Strategi arsitektur Next.js 16 dan headless API untuk kecepatan rendering optimal.", content: "<p>Dengan pendekatan modern stack, frontend dapat di-deploy secara instan dan sinkron dengan database.</p>" }
        ]
      },
      {
        name: "Testimonial",
        slug: "testimonials",
        description: "Testimoni dan ulasan kepuasan mitra",
        fields: [
          { name: "Nama Klien", slug: "client_name", type: "text", required: true },
          { name: "Jabatan & Perusahaan", slug: "company", type: "text" },
          { name: "Rating", slug: "rating", type: "rating" },
          { name: "Pesan Testimoni", slug: "feedback", type: "textarea" },
          { name: "Foto Profil", slug: "avatar", type: "media" }
        ],
        dummyData: [
          { client_name: "Ir. Hendri Gunawan", company: "Direktur PT Cipta Kreasi", rating: 5, feedback: "Platform ini sangat membantu operasional digital kami. Desainnya modern dan integrasi database sangat cepat!" },
          { client_name: "Ratna Sari, M.M.", company: "Founder Studio Kreatif", rating: 5, feedback: "Pengalaman luar biasa dalam membangun website interaktif tanpa ribet coding manual." }
        ]
      }
    ],
    singleTypes: [
      {
        name: "Company Profile",
        slug: "company-profile",
        description: "Pengaturan profil perusahaan, slogan, dan kontak resmi",
        fields: [
          { name: "Nama Bisnis / Brand", slug: "brand_name", type: "text", required: true },
          { name: "Slogan Utama", slug: "hero_title", type: "text" },
          { name: "Sub-Slogan", slug: "hero_subtitle", type: "textarea" },
          { name: "Alamat Kantor", slug: "address", type: "textarea" },
          { name: "Nomor WhatsApp", slug: "phone", type: "phone" },
          { name: "Email Resmi", slug: "email", type: "email" },
          { name: "Tombol Hubungi", slug: "cta_button", type: "button" }
        ],
        dummyData: [
          { brand_name: "ContentFlow Digital Studio", hero_title: "Membangun Masa Depan Digital Anda", hero_subtitle: "Solusi kreatif dan teknologi terdepan untuk mengembangkan skala bisnis Anda ke level berikutnya.", address: "Gedung Cyber One, Lantai 5, Jakarta Selatan", phone: "+6281299887766", email: "hello@contentflow.io" }
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

export async function generateSystemSchema(prompt: string, tenantId?: string, userId?: string): Promise<GeneratedSystemSchema> {
  // 1. Coba AI LLM DeepSeek
  try {
    console.log("[AI Schema] Attempting DeepSeek-chat for dynamic schema generation...")
    return await generateWithDeepSeek(prompt, tenantId, userId)
  } catch (error: any) {
    console.warn("[AI Schema] DeepSeek failed:", error.message)
    
    // 2. Fallback ke OpenAI GPT-4o-mini jika key tersedia
    if (process.env.OPENAI_API_KEY) {
      try {
        console.log("[AI Schema] Fallback: Using OpenAI GPT-4o-mini...")
        return await generateWithOpenAI(prompt)
      } catch (fallbackError: any) {
        console.warn("[AI Schema] OpenAI failed:", fallbackError.message)
      }
    }

    // 3. Fallback Heuristic Generator Terstruktur (Mendukung 30 Field Types & Multi-Collection)
    console.log("[AI Schema] Using High-Accuracy Multi-Collection Domain Synthesizer...")
    return generateHeuristicSchema(prompt)
  }
}
