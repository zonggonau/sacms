# SaCMS API Specification

**Baseline:** 19 June 2026  
**Contract status:** Public collection, Single Type, and GraphQL routes are the stable external surface. Tenant routes are session-authenticated dashboard APIs and may evolve with the UI. `04-openapi.yaml` documents only the stable public subset.

Dokumentasi ini menjelaskan Public API SaCMS, API internal tenant, developer endpoint, dan cron. Semua contoh `{tenant}` menerima slug tenant kecuali dinyatakan lain.

## 🔑 Autentikasi
Public content requests must include:
`Authorization: Bearer <YOUR_API_TOKEN>`

Token rules:

- `read-only`: can only read `PUBLISHED` content.
- `full-access`: may query another valid content status and execute supported GraphQL/Single Type mutations.
- The token must belong to the tenant in the route and must not be expired.
- The plaintext token is displayed only at creation; the server stores SHA-256.

Tenant Management endpoints use the NextAuth session cookie rather than an API token.

---

## 🔍 REST API: Filtering & Querying
Endpoint: `GET /api/public/[tenant]/content/[contentType]`

### 1. Filtering (Strapi-style)
Gunakan parameter `filters` untuk menyaring data berdasarkan field di dalam JSON `data`.

**Operator yang didukung:**
- `$eq`: Equal (Sama dengan)
- `$ne`: Not equal
- `$lt`, `$lte`: Less than (or equal)
- `$gt`, `$gte`: Greater than (or equal)
- `$contains`: Case-insensitive search
- `$startsWith`, `$endsWith`: Prefix/suffix match
- `$in`, `$notIn`: Array of values (pisahkan dengan koma)
- `$null`, `$notNull`: Check for null values

**Contoh:**
- Cari artikel dengan harga di atas 50.000:
  `?filters[price][$gte]=50000`
- Cari artikel yang judulnya mengandung kata "Nextjs":
  `?filters[title][$contains]=nextjs`
- Filter dengan logika OR:
  `?filters[$or][0][category][$eq]=tech&filters[$or][1][featured][$eq]=true`

### 2. Relation Population
Secara default, field relasi hanya akan mengembalikan ID. Gunakan `populate` untuk menarik data lengkap.

- Populasikan field tertentu: `?populate=author,category`
- Populasikan semua relasi tingkat pertama: `?populate=*`

### 3. Full-Text Search
Pencarian teks lengkap yang dioptimalkan dengan PostgreSQL GIN Index.
`?search=kata kunci pencarian`

### 4. Localization (i18n)
Ambil konten dalam bahasa spesifik.
`?locale=id` (Default: `en`)

### 5. Sorting & Pagination
- Urutkan berdasarkan field: `?sort=price:desc` atau `?sort=createdAt:asc`
- Paginasi: `?page=1&pageSize=10` atau `?pagination[page]=1&pagination[pageSize]=10`
- Seleksi field: `?fields=title,slug,summary`
- Status: `?status=DRAFT` hanya untuk token `full-access`; default selalu `PUBLISHED`.
- Metadata locale, populate relasi, dan fallback ke locale default mengikuti batas visibilitas yang sama; token `read-only` tidak menerima varian yang belum `PUBLISHED`.
- `pageSize` dibatasi maksimum 100.

**Response shape:**

```json
{
  "data": [
    {
      "id": "...",
      "title": "Example",
      "locale": "id",
      "availableLocales": ["id", "en"],
      "status": "PUBLISHED",
      "publishedAt": "2026-06-19T07:00:00.000Z",
      "createdAt": "...",
      "updatedAt": "..."
    }
  ],
  "meta": {
    "contentType": { "name": "Articles", "slug": "articles" },
    "pagination": { "page": 1, "pageSize": 25, "total": 1, "totalPages": 1 }
  }
}
```

Important headers include `X-RateLimit-*`, `X-Cache`, and `Cache-Control`. Authentication and tenant/status authorization occur before a cached response is returned.

---

## 🧩 Single Types REST API
Endpoint: `GET /api/public/[tenant]/single/[singleType]`
Endpoint: `PUT /api/public/[tenant]/single/[singleType]`

Single Type reads are locale-aware. If `?locale=` is omitted, the server falls back to the tenant default locale and then to `en` when no default locale exists.

- `read-only` tokens can only read the published variant for the resolved locale.
- `full-access` tokens may read and update the supported Single Type endpoint.
- Cache keys are separated by tenant, locale, and token type so read-only and full-access requests never share a payload.
- PUT requests use the same locale resolution as GET and invalidate cached variants after save.

---

## 🧬 GraphQL API
Endpoint: `POST /api/public/[tenant]/graphql`

### 1. Query Collection
```graphql
query {
  articles(page: 1, limit: 5, sort: "createdAt", order: "desc") {
    data {
      id
      title
      slug
      content
    }
    meta {
      total
      totalPages
    }
  }
}
```
*Catatan:* GraphQL API di SaCMS kini mendukung **Deep Resolution** secara otomatis. Jika Anda melakukan kueri pada field yang berupa relasi (ke *Content Type* maupun *Single Type*) atau berupa komponen, sistem akan secara otomatis mempopulasinya secara rekursif sehingga klien menerima struktur JSON yang utuh tanpa perlu melakukan *waterfall requests*.

### 2. Mutations (Membutuhkan Full-Access Token)
**Create Entry:**
```graphql
mutation {
  createArticle(data: { title: "New Article", slug: "new-article" }, locale: "en") {
    id
    title
  }
}
```

**Update Entry:**
```graphql
mutation {
  updateArticle(id: "ID_ENTRI", data: { title: "Updated Title" }) {
    id
    title
  }
}
```

---

## 🛠️ Pemeliharaan System (FTS)
Jika Anda menambahkan field baru atau ingin melakukan re-index manual pada Full-Text Search, jalankan:
```bash
npx tsx scripts/setup-fts.ts
```

---

## 🏗️ Tenant Management API
Endpoint internal untuk mengelola data workspace. Memerlukan sesi NextAuth yang valid (cookie `next-auth.session-token`) dan keanggotaan aktif di tenant yang dituju.

> **Base Path:** `/api/tenant/[tenant]/`

### 📋 Content Types
| Method | Path | Deskripsi |
|--------|------|-----------|
| `POST` | `/api/tenant/[tenant]/content-types/slug/[slug]/entries/bulk` | Jalankan aksi massal terhadap entry berdasarkan payload |

### 🤖 AI Content Generation
Semua endpoint AI memerlukan addon `ai-gen` aktif pada tenant (kecuali plan Enterprise/Custom).

| Method | Path | Deskripsi |
|--------|------|-----------|
| `POST` | `/api/tenant/[tenant]/ai/generate` | Generate teks untuk satu field dari prompt |
| `POST` | `/api/tenant/[tenant]/ai/generate-component` | Generate konten untuk field komponen |
| `POST` | `/api/tenant/[tenant]/ai/generate-schema` | Generate definisi Content Type dari deskripsi natural language |
| `POST` | `/api/tenant/[tenant]/ai/generate-single-type` | Generate data untuk Single Type |
| `POST` | `/api/tenant/[tenant]/ai/smart-fill` | Auto-fill semua field dalam sebuah entry dari deskripsi singkat |
| `POST` | `/api/tenant/[tenant]/ai/summarize` | Meringkas teks panjang menjadi deskripsi singkat |
| `POST` | `/api/tenant/[tenant]/ai/translate` | Menerjemahkan konten ke locale target |

**Contoh request `smart-fill`:**
```json
POST /api/tenant/my-workspace/ai/smart-fill
{
  "prompt": "Artikel tentang tutorial Next.js 16 untuk pemula",
  "contentType": "Articles",
  "schema": [
    { "slug": "title", "type": "text", "required": true },
    { "slug": "content", "type": "richText", "required": true }
  ]
}
```

**Model AI yang digunakan:** DeepSeek V3 (`deepseek-chat`) dengan fallback ke `deepseek-reasoner`. Memerlukan env var `DEEPSEEK_API_KEY`.

### 🔑 API Tokens
| Method | Path | Deskripsi |
|--------|------|-----------|
| `GET` | `/api/tenant/[tenant]/api-tokens` | List semua token milik tenant |
| `POST` | `/api/tenant/[tenant]/api-tokens` | Buat token baru (prefix `cf_`, hash SHA-256) |
| `GET` | `/api/tenant/[tenant]/api-tokens/[tokenId]` | Ambil metadata token tanpa hash/plaintext |
| `DELETE` | `/api/tenant/[tenant]/api-tokens/[tokenId]` | Hapus token |

Plaintext token yang baru dibuat ditampilkan **satu kali** dalam respons. List/detail dan metadata create tidak mengembalikan hash tersimpan. Sistem hanya menyimpan hash SHA-256.

### 📋 Audit Logs
| Method | Path | Deskripsi |
|--------|------|-----------|
| `GET` | `/api/tenant/[tenant]/audit-logs` | Ambil log audit (filter: `?action=`, `?userId=`, `?from=`, `?to=`) |

Retensi log bergantung pada plan (`audit_log_retention` dalam hari). Free plan tidak memiliki retensi log.

### 📊 Export & Import
| Method | Path | Deskripsi |
|--------|------|-----------|
| `GET` | `/api/tenant/[tenant]/export` | Export data tenant sebagai JSON/ZIP |
| `POST` | `/api/tenant/[tenant]/import` | Import data dari file JSON/ZIP |

**Query params export:** `?types=contentTypes,entries,media&format=json`

### 🧾 Invoices
| Method | Path | Deskripsi |
|--------|------|-----------|
| `GET` | `/api/tenant/[tenant]/invoices` | List invoice pembayaran tenant |

### 🌍 Locales (i18n)
| Method | Path | Deskripsi |
|--------|------|-----------|
| `GET` | `/api/tenant/[tenant]/locales` | List locale yang aktif di tenant |
| `POST` | `/api/tenant/[tenant]/locales` | Tambah locale baru |
| `PATCH` | `/api/tenant/[tenant]/locales/[localeId]` | Update locale (termasuk default/enabled) |
| `DELETE` | `/api/tenant/[tenant]/locales/[localeId]` | Hapus locale |

### 🖼️ Media
| Method | Path | Deskripsi |
|--------|------|-----------|
| `GET` | `/api/tenant/[tenant]/media` | List aset media (filter: `?folder=`, `?type=`) |
| `POST` | `/api/tenant/[tenant]/media` | Upload file ke Cloudflare R2 (multipart/form-data) |
| `GET` | `/api/tenant/[tenant]/media/[mediaId]` | Ambil metadata/signed access media |
| `PATCH` | `/api/tenant/[tenant]/media/[mediaId]` | Update metadata media |
| `DELETE` | `/api/tenant/[tenant]/media/[mediaId]` | Hapus media dari R2 dan database |

Sistem otomatis menghasilkan versi **thumbnail** (150px) dan **medium** saat upload.

### 👥 Members (Team Management)
| Method | Path | Deskripsi |
|--------|------|-----------|
| `GET` | `/api/tenant/[tenant]/members` | List anggota tim |
| `POST` | `/api/tenant/[tenant]/members` | Undang anggota baru via email |
| `PATCH` | `/api/tenant/[tenant]/members/[memberId]` | Ubah role anggota |
| `DELETE` | `/api/tenant/[tenant]/members/[memberId]` | Hapus anggota dari workspace |

**Roles yang tersedia:** `owner`, `admin`, `editor`, `viewer`

### 🛡️ RBAC (Role-Based Access Control)
| Method | Path | Deskripsi |
|--------|------|-----------|
| `GET` | `/api/tenant/[tenant]/rbac` | Lihat mapping permission saat ini |
| `POST` | `/api/tenant/[tenant]/rbac` | Simpan mapping permission |
| `POST` | `/api/tenant/[tenant]/rbac/roles` | Buat custom role |
| `DELETE` | `/api/tenant/[tenant]/rbac/roles/[roleId]` | Hapus custom role |
| `GET` | `/api/tenant/[tenant]/roles` | List role tenant |
| `POST` | `/api/tenant/[tenant]/roles` | Buat role tenant |
| `GET` | `/api/tenant/[tenant]/roles/[roleSlug]` | Detail role |
| `PATCH` | `/api/tenant/[tenant]/roles/[roleSlug]` | Update role/permissions |
| `DELETE` | `/api/tenant/[tenant]/roles/[roleSlug]` | Hapus role |

### ⚙️ Settings
| Method | Path | Deskripsi |
|--------|------|-----------|
| `GET` | `/api/tenant/[tenant]/settings` | Ambil pengaturan workspace |
| `PUT` | `/api/tenant/[tenant]/settings` | Update pengaturan workspace |

### 📈 Stats & Usage
| Method | Path | Deskripsi |
|--------|------|-----------|
| `GET` | `/api/tenant/[tenant]/stats` | Statistik konten (total entries, media size, dll) |
| `GET` | `/api/tenant/[tenant]/usage` | Penggunaan resource vs limit plan |
| `GET` | `/api/tenant/[tenant]/billing/usage` | Detail penggunaan untuk billing |

### 💳 Subscription & Billing
| Method | Path | Deskripsi |
|--------|------|-----------|
| `GET` | `/api/tenant/[tenant]/subscriptions/plans` | List semua paket yang tersedia |
| `PATCH` | `/api/tenant/[tenant]/subscription/plan` | Upgrade/Downgrade plan |
| `POST` | `/api/tenant/[tenant]/subscription/cancel` | Batalkan langganan |
| `POST` | `/api/tenant/[tenant]/subscription/prorate` | Kalkulasi biaya prorate untuk upgrade |

### 🔗 Webhooks
| Method | Path | Deskripsi |
|--------|------|-----------|
| `GET` | `/api/tenant/[tenant]/webhooks` | List webhook yang dikonfigurasi |
| `POST` | `/api/tenant/[tenant]/webhooks` | Tambah endpoint webhook baru |
| `PUT` | `/api/tenant/[tenant]/webhooks/[webhookId]` | Update konfigurasi webhook |
| `DELETE` | `/api/tenant/[tenant]/webhooks/[webhookId]` | Hapus webhook |
| `GET` | `/api/tenant/[tenant]/webhooks/[webhookId]/logs` | Log eksekusi webhook |
| `GET` | `/api/tenant/[tenant]/webhooks/dead-letters` | Antrian DLQ (webhook gagal pending retry) |

**Events yang dapat di-subscribe:**
- `content.created`, `content.updated`, `content.deleted`, `content.published`
- `content.beforeCreate`, `content.beforeUpdate` *(sync hook)*
- `media.uploaded`, `media.deleted`

### 🎨 White-Label & Custom Domain
| Method | Path | Deskripsi |
|--------|------|-----------|
| `GET` | `/api/tenant/[tenant]/white-label` | Ambil konfigurasi white-label |
| `PATCH` | `/api/tenant/[tenant]/white-label` | Update branding (logo, warna, nama) |
| `GET` | `/api/tenant/[tenant]/white-label/domain` | Ambil domain dan record verifikasi |
| `PUT` | `/api/tenant/[tenant]/white-label/domain` | Daftarkan, ganti, atau hapus domain |
| `POST` | `/api/tenant/[tenant]/white-label/domain` | Jalankan verifikasi DNS TXT |

White-Label dan Custom Domain memerlukan plan Pro, Enterprise, atau Custom. Model saat ini mendukung satu domain per tenant.

### 🔄 Workflow
| Method | Path | Deskripsi |
|--------|------|-----------|
| `GET` | `/api/tenant/[tenant]/workflow/reviewers?entryId=...` | Ambil assignment reviewer suatu entry |
| `POST` | `/api/tenant/[tenant]/workflow/reviewers` | Ganti urutan assignment reviewer |
| `PATCH` | `/api/tenant/[tenant]/workflow/reviewers` | Kirim keputusan reviewer saat ini |

---

## 🔐 Developer Endpoints
| Method | Path | Deskripsi |
|--------|------|-----------|
| `GET` | `/api/tenant/[tenant]/developer/openapi` | Generate spesifikasi OpenAPI untuk content types tenant |
| `GET` | `/api/tenant/[tenant]/developer/ai-prompt` | Download prompt Markdown untuk generator frontend |

Developer prompt tidak memanggil provider AI. Dokumen hasil memakai placeholder `<YOUR_API_TOKEN>`; hash token yang tersimpan tidak pernah diekspor sebagai credential.

---

## 🕐 Cron Endpoints
Diproteksi oleh header `Authorization: Bearer <CRON_SECRET>`.

| Method | Path | Interval | Deskripsi |
|--------|------|----------|-----------|
| `GET` | `/api/cron/publish` | Setiap 5 menit pada `vercel.json` | Auto-publish konten berstatus `SCHEDULED` |
| `GET` | `/api/cron/webhook-retry` | Setiap 2 menit pada `vercel.json` | Retry webhook di DLQ dengan exponential backoff |
| `GET` | `/api/cron/backup` | Jadwal eksternal/belum ada di `vercel.json` | Jalankan backup terkonfigurasi |

## Error conventions

| Status | Arti umum |
|---:|---|
| `400` | Payload/query tidak valid |
| `401` | Sesi/token tidak ada, salah, atau kedaluwarsa |
| `403` | Tenant, role, token type, feature, atau plan tidak mengizinkan |
| `404` | Resource tidak ada di scope tenant |
| `409` | Konflik lifecycle/keunikan, misalnya domain atau status review |
| `429` | Rate limit/provider quota |
| `500` | Error internal yang tidak dapat dipulihkan pada request tersebut |
| `503` | Integrasi opsional belum dikonfigurasi/tersedia |

## Contract limitations

- Public REST Collection saat ini menyediakan endpoint daftar/filter, bukan route langsung `/content/{type}/{entryId}`.
- Mutasi Collection eksternal dilakukan melalui GraphQL dengan token `full-access`; REST Collection tidak menyediakan POST/PATCH/DELETE.
- Tenant API merupakan surface internal dashboard dan menggunakan session cookie.
- Detail payload/response AI terdapat pada dokumen 12; domain pada dokumen 13; workflow pada dokumen 14.
