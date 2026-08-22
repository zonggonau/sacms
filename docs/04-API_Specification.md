# SaCMS API Specification

**Baseline:** 23 Agustus 2026 (v1.2.1.0)  
**Contract Status:** Public collection, Single Type, GraphQL, and MCP routes represent the stable integration surface. Tenant management routes are session-authenticated dashboard APIs.

---

## 🔑 1. Autentikasi & Otorisasi

### 1.1 Public API Tokens
Setiap request ke endpoint public konten wajib menyertakan header:
```http
Authorization: Bearer <YOUR_API_TOKEN>
```

**Aturan Token:**
- **Prefix:** Selalu diawali dengan `cf_` (contoh: `cf_live_a1b2c3d4...`).
- **Penyimpanan:** Plaintext token hanya ditampilkan **satu kali** saat dibuat. Database hanya menyimpan hash **SHA-256**.
- **Scope Tipe:**
  - `read-only`: Hanya dapat membaca konten berstatus `PUBLISHED`.
  - `full-access`: Dapat membaca draft, konten terjadwal, dan melakukan mutasi data via GraphQL / Single Type PUT.
- **Isolasi Tenant:** Token terikat secara absolut pada satu `tenantId`. Request lintas tenant akan ditolak dengan `403 Forbidden`.

---

## 🔍 2. Public REST API: Filtering & Querying

**Endpoint Koleksi:** `GET /api/public/[tenant]/content/[contentType]`

### 2.1 Filtering (Strapi-style Operators)
Gunakan parameter `filters` pada query string untuk memfilter data JSON:

| Operator | Deskripsi | Contoh |
|---|---|---|
| `$eq` | Sama dengan (Equal) | `?filters[category][$eq]=technology` |
| `$ne` | Tidak sama dengan (Not Equal) | `?filters[status][$ne]=archived` |
| `$gt` / `$gte` | Lebih besar dari / sama dengan | `?filters[price][$gte]=50000` |
| `$lt` / `$lte` | Lebih kecil dari / sama dengan | `?filters[stock][$lte]=10` |
| `$contains` | Pencarian teks (Case-insensitive) | `?filters[title][$contains]=nextjs` |
| `$startsWith` / `$endsWith` | Awalan / Akhiran teks | `?filters[slug][$startsWith]=tutorial-` |
| `$in` / `$notIn` | Berada dalam list nilai | `?filters[tag][$in]=react,nextjs,ai` |
| `$null` / `$notNull` | Memeriksa nilai kosong / tidak kosong | `?filters[deletedAt][$null]=true` |

**Logika OR:**
```http
GET /api/public/agency-1/content/articles?filters[$or][0][featured][$eq]=true&filters[$or][1][views][$gte]=1000
```

### 2.2 Relasi & Deep Population
- Populasikan relasi spesifik: `?populate=author,category`
- Populasikan seluruh relasi tingkat pertama: `?populate=*`

### 2.3 Full-Text Search (FTS)
Pencarian teks cepat dioptimalkan menggunakan PostgreSQL GIN Index pada kolom `searchVector`:
```http
GET /api/public/agency-1/content/articles?search=headless+cms+architecture
```

### 2.4 Localization (i18n)
```http
GET /api/public/agency-1/content/articles?locale=id
```
*(Jika `locale` tidak disertakan, sistem secara otomatis menggunakan default locale tenant atau fallback ke `en`)*

### 2.5 Sorting & Pagination
- **Sorting:** `?sort=createdAt:desc` atau `?sort=price:asc,createdAt:desc`
- **Pagination:** `?page=1&pageSize=25` (Maksimum `pageSize` adalah 100)
- **Field Selection:** `?fields=title,slug,coverImage`

**Contoh Format Respons:**
```json
{
  "data": [
    {
      "id": "cm123abc456",
      "title": "Tutorial Next.js 16 App Router",
      "slug": "tutorial-nextjs-16",
      "locale": "id",
      "availableLocales": ["id", "en"],
      "status": "PUBLISHED",
      "publishedAt": "2026-08-23T01:00:00.000Z",
      "createdAt": "2026-08-23T00:30:00.000Z",
      "updatedAt": "2026-08-23T01:00:00.000Z",
      "data": {
        "author": { "id": "user_1", "name": "Admin" },
        "content": "<p>Panduan lengkap...</p>"
      }
    }
  ],
  "meta": {
    "contentType": { "name": "Articles", "slug": "articles" },
    "pagination": { "page": 1, "pageSize": 25, "total": 1, "totalPages": 1 }
  }
}
```

---

## 🧩 3. Public Single Types REST API

- **Read:** `GET /api/public/[tenant]/single/[singleType]`
- **Update (Full-Access Token):** `PUT /api/public/[tenant]/single/[singleType]`

Mendukung isolasi cache terpisah antar-locale dan antar-tipe token (`read-only` vs `full-access`).

---

## 🧬 4. Public GraphQL API

**Endpoint:** `POST /api/public/[tenant]/graphql`  
**Header:** `Content-Type: application/json` dan `Authorization: Bearer <API_TOKEN>`

### 4.1 Query Collection dengan Deep Resolution
```graphql
query GetArticles {
  articles(page: 1, limit: 10, sort: "createdAt", order: "desc") {
    data {
      id
      title
      slug
      content
      author {
        name
        avatar
      }
    }
    meta {
      total
      totalPages
    }
  }
}
```

### 4.2 Mutations (Memerlukan Token Full-Access)
```graphql
mutation CreateNewArticle {
  createArticle(
    data: {
      title: "Building with MCP"
      slug: "building-with-mcp"
      content: "Panduan integrasi Model Context Protocol..."
    }
    locale: "en"
  ) {
    id
    title
    status
  }
}
```

---

## 🤖 5. Model Context Protocol (MCP) API

**Endpoint:** `POST /api/mcp/[[...transport]]` / `GET /api/mcp/[[...transport]]`  
**Header:** `Authorization: Bearer <MCP_TOKEN>`

Memungkinkan AI Coding Assistant (seperti Cursor, Windsurf, Claude Code) mengeksekusi *tools* SaCMS:
- `sacms_list_content_types`: Mendapatkan daftar skema dan tipe data.
- `sacms_get_schema`: Membaca field-field dan validasi pada Content Type tertentu.
- `sacms_query_content`: Melakukan pencarian dan pengambilan data entri konten.
- `sacms_create_entry`: Menambahkan draft konten baru secara langsung via AI assistant.

---

## ⚡ 6. AI Builder & Starter Exporter API

| Method | Path | Deskripsi |
|---|---|---|
| `POST` | `/api/tenant/[tenant]/ai-builder/plan-schema` | Merencanakan arsitektur Content Type dari deskripsi domain bisnis |
| `POST` | `/api/tenant/[tenant]/ai-builder/export-starter` | Mengunduh starter project Next.js 16 + TailwindCSS v4 dalam format ZIP |
| `POST` | `/api/tenant/[tenant]/ai-builder/generate-frontend` | Membuat halaman frontend dinamis berbasis konten SaCMS |
| `POST` | `/api/tenant/[tenant]/ai-builder/export-schema` | Mengekspor skema dalam format JSON blueprint portabel |
| `POST` | `/api/tenant/[tenant]/ai-builder/import-schema` | Mengimpor blueprint skema dari file JSON |

---

## 🏢 7. Enterprise Licensing & Self-Hosted API

| Method | Path | Deskripsi |
|---|---|---|
| `POST` | `/api/tenant/[tenant]/license/activate` | Mengaktifkan lisensi Enterprise offline via RSA signature |
| `GET` | `/api/tenant/[tenant]/license/status` | Mengecek status dan tanggal kedaluwarsa lisensi instance |
| `POST` | `/api/admin/license/generate` | (Super Admin) Membuat lisensi RSA baru untuk customer enterprise |
| `GET` | `/api/admin/license/list` | (Super Admin) Melihat daftar lisensi enterprise yang aktif |

---

## ⏰ 8. Automated Cron Endpoints

Semua endpoint cron dilindungi dengan header `Authorization: Bearer <CRON_SECRET>`:

| Method | Path | Deskripsi |
|---|---|---|
| `GET` | `/api/cron/publish` | Mempublikasikan konten berstatus `SCHEDULED` yang telah jatuh tempo |
| `GET` | `/api/cron/webhook-retry` | Mencoba ulang pengiriman webhook yang gagal pada antrean DLQ |
| `GET` | `/api/cron/backup` | Mengeksekusi backup basis data otomatis ke Cloudflare R2 |
| `GET` | `/api/cron/suspend-tenants` | Mengunci akses tenant yang menunggak tagihan Midtrans |
