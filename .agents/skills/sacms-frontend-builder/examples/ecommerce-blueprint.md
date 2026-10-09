# Blueprint E-Commerce / Distro Merchandise (v0-Grade)

Contoh arsitektur menyeluruh dari pembuatan schema via SaCMS MCP hingga kode frontend siap tayang untuk brand merchandise/fashion seperti **Tshirt Papua Authentic**.

---

## 1. Eksekusi Schema via SaCMS MCP

### A. Buat Koleksi Kategori (`categories`)
```json
{
  "name": "Kategori Produk",
  "slug": "categories",
  "description": "Kategori produk kaos dan merchandise",
  "showInCms": true,
  "fields": [
    { "name": "Nama Kategori", "slug": "name", "type": "text", "required": true },
    { "name": "Slug", "slug": "slug", "type": "text", "required": true, "unique": true },
    { "name": "Ikon", "slug": "icon", "type": "icon" }
  ]
}
```

### B. Buat Koleksi Produk (`products`)
```json
{
  "name": "Katalog Produk",
  "slug": "products",
  "description": "Koleksi produk kaos, jaket, dan merchandise Papua",
  "showInCms": true,
  "fields": [
    { "name": "Nama Produk", "slug": "name", "type": "text", "required": true },
    { "name": "Slug", "slug": "slug", "type": "text", "required": true, "unique": true },
    { "name": "Harga", "slug": "price", "type": "currency", "required": true, "options": { "currencyCode": "IDR" } },
    { "name": "Harga Coret", "slug": "discountPrice", "type": "currency", "options": { "currencyCode": "IDR" } },
    { "name": "Deskripsi Singkat", "slug": "excerpt", "type": "textarea", "required": true },
    { "name": "Kategori", "slug": "category", "type": "text", "required": true },
    { "name": "Pilihan Ukuran", "slug": "sizes", "type": "tags" },
    { "name": "Foto Utama", "slug": "image", "type": "media", "required": true },
    { "name": "Rating", "slug": "rating", "type": "rating" },
    { "name": "Terjual", "slug": "salesCount", "type": "number" },
    { "name": "Stok", "slug": "stock", "type": "number", "required": true },
    { "name": "Produk Unggulan", "slug": "isFeatured", "type": "boolean" },
    { "name": "Tersedia", "slug": "isAvailable", "type": "boolean" }
  ]
}
```

### C. Buat Single Type Profil Toko (`store-profile`)
```json
{
  "name": "Profil Toko",
  "slug": "store-profile",
  "description": "Informasi brand, kontak, dan alamat toko",
  "fields": [
    { "name": "Nama Toko", "slug": "storeName", "type": "text", "required": true },
    { "name": "Tagline", "slug": "tagline", "type": "text" },
    { "name": "WhatsApp Pemesanan", "slug": "whatsapp", "type": "phone", "required": true },
    { "name": "Alamat Lengkap", "slug": "address", "type": "textarea" },
    { "name": "Jam Buka", "slug": "operatingHours", "type": "text" },
    { "name": "Instagram", "slug": "instagram", "type": "text" }
  ],
  "initialData": {
    "storeName": "Tshirt Papua Authentic",
    "tagline": "Kebanggaan Budaya Papua dalam Balutan Katun Premium Distro",
    "whatsapp": "6281234567890",
    "address": "Jl. Percetakan Negara No. 45, Gurabesi, Kota Jayapura, Papua",
    "operatingHours": "Senin - Sabtu: 09.00 - 21.00 WIT",
    "instagram": "@tshirtpapua_official"
  }
}
```

---

## 2. Seeding Data Realistis (via `create_content_entry`)

Suntikkan 4-6 produk unggulan dengan foto asli Unsplash resolusi tinggi:
* **Produk 1:** Kaos Motif Ukiran Asmat Black Gold (`Rp 149.000`)
* **Produk 2:** Kaos Siluet Burung Cenderawasih Earth Tone (`Rp 159.000`)
* **Produk 3:** Kaos Tipografi Mambruk Minimalist White (`Rp 139.000`)
* **Produk 4:** Hoodie Zip Papua Heritage Navy (`Rp 289.000`)
* **Produk 5:** Kaos Oversize Noken Pattern Sage Green (`Rp 169.000`)

---

## 3. Template Client SaCMS Terpadu (`lib/sacms.ts`)

```typescript
const SACMS_BASE_URL = process.env.NEXT_PUBLIC_SACMS_URL || "http://localhost:3000";
const TENANT_SLUG = process.env.NEXT_PUBLIC_TENANT_SLUG || "d78ff319b79b5165";

export interface SaCMSResponse<T> {
  data: T[];
  meta?: {
    pagination: {
      page: number;
      pageSize: number;
      total: number;
      pageCount: number;
    };
  };
}

export async function fetchCollection<T = any>(
  contentType: string,
  params?: Record<string, string | number>
): Promise<T[]> {
  try {
    const query = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([k, v]) => query.set(k, String(v)));
    }
    const res = await fetch(`${SACMS_BASE_URL}/api/public/${TENANT_SLUG}/content/${contentType}?${query}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return [];
    const json: SaCMSResponse<T> = await res.json();
    return json.data || [];
  } catch (error) {
    console.warn(`[SaCMS] Gagal mengambil ${contentType}, menggunakan fallback lokal:`, error);
    return [];
  }
}

export async function fetchSingle<T = any>(slug: string): Promise<T | null> {
  try {
    const res = await fetch(`${SACMS_BASE_URL}/api/public/${TENANT_SLUG}/single/${slug}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.data || json;
  } catch (error) {
    console.warn(`[SaCMS] Gagal mengambil single ${slug}:`, error);
    return null;
  }
}
```
