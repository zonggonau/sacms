# SaCMS MCP Schema & Data Provisioning Cheatsheet

Referensi parameter teknis resmi untuk seluruh pemanggilan MCP Tool SaCMS (`sacms`) saat membangun schema database dan seeding data konten.

---

## 1. `get_full_schema`
Menginspeksi seluruh skema yang sudah ada di workspace aktif. Panggil tool ini **pertama kali** untuk menghindari duplikasi Content Type atau Single Type yang sudah ada.

```json
{}
```

---

## 2. `create_content_type`
Membuat skema koleksi (Content Type) baru.

### Parameter:
* `name`: Nama tampilan (misal: `"Produk Kaos"`, `"Kategori"`, `"Ulasan Pelanggan"`)
* `slug`: URL slug unik (misal: `"products"`, `"categories"`, `"reviews"`)
* `description`: Penjelasan koleksi
* `showInCms`: `true`
* `fields`: Array field definitions:
  * `name`: Label field (misal: `"Harga"`)
  * `slug`: Key identifier (misal: `"price"`)
  * `type`: Salah satu dari 33 tipe field:
    * `text`: Teks pendek (Judul, Nama, Kode SKU)
    * `textarea`: Teks multi-baris tanpa format (Ringkasan)
    * `richText`: Format HTML/WYSIWYG (Deskripsi lengkap, Spesifikasi)
    * `markdown`: Konten format Markdown
    * `number`: Angka numerik (Stok, Berat, Durasi)
    * `currency`: Nilai uang dengan format mata uang (options: `{ "currencyCode": "IDR" }`)
    * `percent`: Persentase diskon
    * `date` / `datetime`: Tanggal & Waktu
    * `select`: Pilihan tunggal (options: `{ "choices": [{ "label": "Lengan Pendek", "value": "short" }] }`)
    * `multiselect` / `tags`: Pilihan ganda atau tag kata kunci
    * `boolean`: Status toggle (misal: `isFeatured`, `isAvailable`)
    * `media` / `mediaMultiple`: URL gambar atau galeri foto
    * `rating`: Nilai bintang 1-5
    * `relation`: Relasi ke Content Type lain (wajib sertakan `relationSlug: "categories"`)
  * `required`: boolean
  * `unique`: boolean
  * `localizable`: boolean

### Contoh Payload Pembuatan `products`:
```json
{
  "name": "Katalog Produk",
  "slug": "products",
  "description": "Koleksi katalog produk kaos dan merchandise",
  "showInCms": true,
  "fields": [
    { "name": "Nama Produk", "slug": "name", "type": "text", "required": true },
    { "name": "Slug URL", "slug": "slug", "type": "text", "required": true, "unique": true },
    { "name": "Harga", "slug": "price", "type": "currency", "required": true, "options": { "currencyCode": "IDR" } },
    { "name": "Harga Coret", "slug": "discountPrice", "type": "currency", "options": { "currencyCode": "IDR" } },
    { "name": "Deskripsi Singkat", "slug": "excerpt", "type": "textarea", "required": true },
    { "name": "Deskripsi Lengkap", "slug": "description", "type": "richText" },
    { "name": "Kategori", "slug": "category", "type": "text", "required": true },
    { "name": "Pilihan Ukuran", "slug": "sizes", "type": "tags" },
    { "name": "Foto Utama", "slug": "image", "type": "media", "required": true },
    { "name": "Galeri Foto", "slug": "gallery", "type": "mediaMultiple" },
    { "name": "Rating", "slug": "rating", "type": "rating" },
    { "name": "Jumlah Terjual", "slug": "salesCount", "type": "number" },
    { "name": "Stok", "slug": "stock", "type": "number", "required": true },
    { "name": "Produk Unggulan", "slug": "isFeatured", "type": "boolean" },
    { "name": "Tersedia", "slug": "isAvailable", "type": "boolean" }
  ]
}
```

---

## 3. `create_single_type`
Membuat singleton page (pengaturan satu rekaman, profil bisnis, kontak).

```json
{
  "name": "Profil Toko",
  "slug": "store-profile",
  "description": "Informasi kontak, branding, dan narasi toko",
  "fields": [
    { "name": "Nama Toko", "slug": "storeName", "type": "text", "required": true },
    { "name": "Tagline", "slug": "tagline", "type": "text" },
    { "name": "Tentang Kami", "slug": "about", "type": "richText" },
    { "name": "Nomor WhatsApp", "slug": "whatsapp", "type": "phone", "required": true },
    { "name": "Alamat Fisik", "slug": "address", "type": "textarea" },
    { "name": "Jam Operasional", "slug": "operatingHours", "type": "text" },
    { "name": "Link Google Maps", "slug": "mapsUrl", "type": "url" },
    { "name": "Banner Hero", "slug": "heroBanner", "type": "media" },
    { "name": "Instagram", "slug": "instagram", "type": "text" }
  ],
  "initialData": {
    "storeName": "Tshirt Papua Authentic",
    "tagline": "Kebanggaan Budaya Cenderawasih dalam Balutan Katun Premium",
    "about": "Tshirt Papua didirikan untuk mempromosikan seni motif ukiran khas Papua dengan standar bahan katun combed 24s berkualitas tinggi dan tinta sablon discharge ramah lingkungan.",
    "whatsapp": "6281234567890",
    "address": "Jl. Percetakan Negara No. 45, Jayapura, Papua",
    "operatingHours": "Senin - Sabtu: 09.00 - 21.00 WIT",
    "mapsUrl": "https://maps.google.com",
    "heroBanner": "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=1200&q=80",
    "instagram": "@tshirtpapua_official"
  }
}
```

---

## 4. `create_content_entry`
Menyuntikkan data rekaman awal (seeding). **Selalu gunakan `status: "PUBLISHED"`** agar endpoint REST API publik langsung mengembalikan data.

```json
{
  "contentTypeSlug": "products",
  "status": "PUBLISHED",
  "locale": "id",
  "data": {
    "name": "Kaos Motif Ukiran Asmat Premium Black",
    "slug": "kaos-ukiran-asmat-black",
    "price": 149000,
    "discountPrice": 175000,
    "excerpt": "Kaos premium bertema ukiran sakral suku Asmat dengan sablon discharge halus tidak terasa di kulit.",
    "description": "<p>Dibuat dari 100% katun combed 24s standar distro premium. Lembut, sejuk, dan menyerap keringat. Dilengkapi jahitan rantai standar ekspor.</p>",
    "category": "Edisi Budaya",
    "sizes": ["S", "M", "L", "XL", "XXL"],
    "image": "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=800&q=80",
    "gallery": [
      "https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=800&q=80",
      "https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?w=800&q=80"
    ],
    "rating": 5,
    "salesCount": 342,
    "stock": 45,
    "isFeatured": true,
    "isAvailable": true
  }
}
```

---

## 5. Konsumsi REST API Publik di Frontend
Endpoint publik ini **tidak memerlukan authentication header** dan sudah mendukung query parameter standar Strapi/Next.js:

* `GET /api/public/{tenantSlug}/content/products` (daftar produk terbit)
* `GET /api/public/{tenantSlug}/content/products?pagination[page]=1&pagination[pageSize]=12`
* `GET /api/public/{tenantSlug}/content/products?filters[category][$eq]=Edisi+Budaya`
* `GET /api/public/{tenantSlug}/content/products?search=asmat`
* `GET /api/public/{tenantSlug}/single/store-profile` (data profil toko tunggal)
