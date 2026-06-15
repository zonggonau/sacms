# PRD: SaCMS v1.0 — Alternatif Strapi untuk SaaS Headless CMS

**Author:** System Architect
**Date:** 15 Maret 2026
**Status:** Draft
**Stakeholder:** Solo Developer / Founder

---

## 1. Executive Summary

### Problem Statement

Strapi adalah headless CMS open-source paling populer, tetapi memiliki keterbatasan fundamental: **tidak mendukung multi-tenancy native**, tidak memiliki billing built-in, dan membutuhkan self-hosting. Developer dan organisasi yang membutuhkan CMS multi-tenant harus membangun sendiri di atas Strapi — effort yang besar dan rawan error.

### Proposed Solution

**SaCMS** adalah SaaS Headless CMS yang menawarkan:

- Multi-tenant native (apa yang tidak bisa dilakukan Strapi)
- Billing & subscription built-in (Midtrans + payment gateway)
- AI-powered content generation
- Developer experience terbaik (SDK, GraphQL mutations, advanced filtering)
- Content workflow (draft → review → publish) dan i18n content

### Success Criteria

| KPI                       | Target v1.0                                       | Timeframe |
| ------------------------- | ------------------------------------------------- | --------- |
| Public API response time  | < 200ms (P95) untuk dataset 10K entries           | Launch    |
| GraphQL query support     | Collection + single + mutations + filtering       | Launch    |
| Content workflow adoption | 100% content types mendukung draft/review/publish | Launch    |
| i18n coverage             | Min 5 locale per tenant                           | Launch    |
| Media upload speed        | < 3 detik untuk file 10MB                         | Launch    |
| SDK type-safety           | 100% TypeScript types auto-generated              | Launch    |
| Uptime                    | 99.5%                                             | Month 1   |

---

## 2. User Experience & Functionality

### 2.1 User Personas

| Persona             | Deskripsi                                     | Kebutuhan Utama                                                       |
| ------------------- | --------------------------------------------- | --------------------------------------------------------------------- |
| **Solo Developer**  | Freelancer yang membangun website untuk klien | CMS cepat setup, API docs jelas, SDK siap pakai                       |
| **Startup CTO**     | Lead tech di startup 5-20 orang               | Multi-tenant untuk beberapa produk, billing otomatis, team management |
| **Content Manager** | Non-technical editor di organisasi            | UI intuitif, workflow approval, scheduled publishing                  |
| **Agency Owner**    | Pemilik agensi digital                        | White-label, multi-client management, billing per client              |

### 2.2 User Stories & Acceptance Criteria

#### Epic 1: Content Workflow

**US-1.1** Sebagai Content Manager, saya ingin menyimpan konten sebagai draft agar bisa melanjutkan editing di lain waktu.

- AC: Entry dapat disimpan dengan status `draft` tanpa validasi field required
- AC: Draft tidak muncul di Public API
- AC: Dashboard menampilkan badge status (Draft/In Review/Published/Archived)

**US-1.2** Sebagai Content Manager, saya ingin mengirim konten untuk review agar editor senior bisa memeriksa sebelum publish.

- AC: Tombol "Submit for Review" mengubah status dari `draft` ke `in_review`
- AC: Reviewer mendapat notifikasi (in-app + webhook)
- AC: Reviewer dapat `approve` atau `reject` dengan komentar

**US-1.3** Sebagai Tenant Admin, saya ingin menjadwalkan publikasi konten agar terbit otomatis pada waktu yang ditentukan.

- AC: Field "Scheduled Publish Date" di content editor
- AC: Cron job mengecek dan mempublikasi konten yang sudah waktunya
- AC: Status berubah dari `scheduled` ke `published` secara otomatis

**US-1.4** Sebagai Content Manager, saya ingin mengarsipkan konten lama tanpa menghapusnya.

- AC: Tombol "Archive" mengubah status ke `archived`
- AC: Konten archived tidak muncul di Public API (kecuali query eksplisit)
- AC: Konten dapat di-restore dari arsip

#### Epic 2: i18n Content Management

**US-2.1** Sebagai Tenant Admin, saya ingin mengaktifkan multi-bahasa untuk workspace saya.

- AC: Settings > Localization menampilkan daftar locale yang tersedia
- AC: Admin dapat menambah/hapus locale (min 1 default locale)
- AC: Setiap content type otomatis mendukung locale yang diaktifkan

**US-2.2** Sebagai Content Manager, saya ingin menulis konten dalam beberapa bahasa.

- AC: Content editor menampilkan locale switcher (tabs atau dropdown)
- AC: Setiap locale memiliki data terpisah tetapi berbagi structure yang sama
- AC: Field yang ditandai `localizable=true` dapat berbeda per locale
- AC: Field non-localizable (slug, relation) di-share across locale

**US-2.3** Sebagai Developer, saya ingin mengambil konten dalam bahasa tertentu via API.

- AC: REST: `?locale=id` atau `?locale=en` mengembalikan konten per bahasa
- AC: GraphQL: `articles(locale: "id")` filter per locale
- AC: Fallback ke default locale jika konten belum diterjemahkan
- AC: Response menunjukkan `availableLocales` per entry

#### Epic 3: Advanced Public API

**US-3.1** Sebagai Developer, saya ingin mem-filter konten berdasarkan field values.

- AC: `?filters[category][$eq]=tutorial` — filter exact match
- AC: `?filters[title][$contains]=next` — filter string contains
- AC: `?filters[price][$gt]=100` — filter number comparison
- AC: `?filters[tags][$in]=react,vue` — filter array contains
- AC: Operator: `$eq`, `$ne`, `$gt`, `$gte`, `$lt`, `$lte`, `$contains`, `$startsWith`, `$endsWith`, `$in`, `$notIn`, `$null`, `$notNull`

**US-3.2** Sebagai Developer, saya ingin mengambil hanya field yang saya butuhkan.

- AC: REST: `?fields=title,slug,author` mengembalikan hanya field terpilih
- AC: GraphQL: field selection via query `{ articles { title slug } }`
- AC: Mengurangi payload size dan response time

**US-3.3** Sebagai Developer, saya ingin meng-expand relasi di satu request.

- AC: `?populate=author` mengembalikan data relasi, bukan hanya ID
- AC: `?populate=author,category` untuk multiple relations
- AC: `?populate=*` untuk semua relasi (depth limit 3)
- AC: GraphQL: nested selection `{ articles { author { name email } } }`

**US-3.4** Sebagai Developer, saya ingin melakukan mutasi via GraphQL.

- AC: `createArticle(data: {...})` — buat entry baru
- AC: `updateArticle(id: "xxx", data: {...})` — update entry
- AC: `deleteArticle(id: "xxx")` — hapus entry
- AC: `publishArticle(id: "xxx")` — publish entry
- AC: Semua mutation memerlukan API token dengan permission `full-access`

#### Epic 4: Cloud Media Storage

**US-4.1** Sebagai Tenant Admin, saya ingin upload media ke cloud storage.

- AC: File di-upload ke S3-compatible storage (Cloudflare R2)
- AC: URL CDN dikembalikan, bukan base64
- AC: Limit 10MB per file (configurable per plan)
- AC: Validasi MIME type: image/_, video/_, audio/\*, application/pdf
- AC: Thumbnail otomatis untuk gambar (150px, 600px)

**US-4.2** Sebagai Developer, saya ingin mengambil media dengan ukuran yang sesuai.

- AC: `?format=thumbnail` mengembalikan versi kecil (150px)
- AC: `?format=medium` mengembalikan 600px
- AC: `?format=original` mengembalikan file asli
- AC: Response headers include `Content-Type` dan `Content-Length`

#### Epic 5: Full-Text Search

**US-5.1** Sebagai Developer, saya ingin mencari konten berdasarkan kata kunci.

- AC: `?search=next.js tutorial` mencari di semua text fields
- AC: Hasil di-rank berdasarkan relevansi
- AC: Highlight snippet dari match yang ditemukan
- AC: Response time < 200ms untuk 10K entries

#### Epic 6: Content Hooks & Extensions

**US-6.1** Sebagai Developer, saya ingin menjalankan logika kustom sebelum/sesudah content disimpan.

- AC: Webhook events ditrigger: `content.beforeCreate`, `content.created`, `content.beforeUpdate`, `content.updated`, `content.beforeDelete`, `content.deleted`, `content.beforePublish`, `content.published`, `media.uploaded`, `media.deleted`
- AC: `before*` hooks (sync) dapat memodifikasi data atau menolak operasi (return error), timeout 5 detik
- AC: `after*` hooks (async) dikirim secara non-blocking, timeout 10 detik
- AC: Log semua hook executions dengan response

#### Epic 7: TypeScript SDK

**US-7.1** Sebagai Developer, saya ingin menggunakan SDK type-safe untuk mengakses SaCMS API.

- AC: NPM package `@sacms/sdk` tersedia
- AC: Auto-generated types berdasarkan content type schema
- AC: Method: `cf.articles.findMany()`, `cf.articles.findOne(id)`, `cf.articles.create(data)`
- AC: Filter API: `cf.articles.findMany({ filters: { category: { $eq: 'tutorial' } } })`
- AC: TypeScript IntelliSense untuk field nama dan tipe

#### Epic 8: Content Modeling (Schema Builder)

**US-8.1** Sebagai Tenant Admin, saya ingin membuat dan mengelola Collection Types agar bisa mendefinisikan struktur database konten berulang.
- AC: Admin dapat membuat, mengubah (nama, deskripsi, slug), dan menghapus *Content Type*.
- AC: Admin dapat menambahkan berbagai macam *Fields* (Text, RichText, Boolean, Number, Date, Media, JSON, Component, Relation) ke dalam struktur tabel.
- AC: Field dapat diatur menjadi *Required*, *Unique*, atau *Localizable*.

**US-8.2** Sebagai Tenant Admin, saya ingin membuat Single Types untuk halaman statis.
- AC: Struktur *Single Type* memiliki fungsi field yang sama dengan *Collection Type*.
- AC: UI memastikan bahwa *Single Type* hanya membolehkan 1 entri data tunggal per *locale*.

**US-8.3** Sebagai Tenant Admin, saya ingin membangun Components agar bisa mendesain *reusable schema block*.
- AC: Komponen terpisah dari Content Types dan dapat disematkan *(nested)* berulang kali.
- AC: Komponen dapat dikategorikan dalam dashboard editor.

#### Epic 9: Workspace, Team & RBAC Management

**US-9.1** Sebagai Pengguna, saya ingin bisa membuat lebih dari satu Workspace (Tenant).
- AC: Saat mendaftar, user dipandu membuat *Workspace* pertamanya.
- AC: User dapat membuat *Workspace* tambahan (tergantung limit pada *Plan* / langganan).
- AC: Isolasi data 100% terjaga; konten dari Tenant A tidak akan bocor ke Tenant B.

**US-9.2** Sebagai Tenant Admin, saya ingin mengundang anggota tim ke Workspace saya.
- AC: Terdapat menu *Team* untuk *Invite member* via email.
- AC: Member dapat diberi standard roles: `owner`, `admin`, `editor`, `member`.
- AC: Admin dapat menghapus member dari Workspace kapan saja.

**US-9.3** Sebagai Tenant Admin, saya ingin mengonfigurasi Custom Role.
- AC: Tersedia opsi pembuatan *Role* baru jika langganan memenuhi kriteria.
- AC: Setiap *Role* bisa dikonfigurasi per-modul *permissions* (misal: read-only API, publish only, dll).

#### Epic 10: API Keys Management

**US-10.1** Sebagai Developer, saya ingin membuat API Token untuk mengakses konten secara terprogram.
- AC: Admin dapat me-generate *Permanent Token* dengan prefiks standar (contoh: `cf_`).
- AC: Token di-hash menggunakan `SHA-256` sebelum disimpan ke database (mendukung O(1) indexed lookup yang cepat, tidak menggunakan bcrypt karena performa validasi token).
- AC: Terdapat kontrol akses token (Scope: Read-only atau Full-access).
- AC: Dashboard dapat me-revoke (mencabut) atau *regenerate* token.

#### Epic 11: Billing & Subscriptions

**US-11.1** Sebagai Tenant Admin, saya ingin mengatur paket langganan (SaaS Plan) dari aplikasi saya.
- AC: Tersedia halaman perbandingan paket (Free, Starter, Pro).
- AC: Fitur integrasi Midtrans Snap berjalan mulus (redirect ke secure payment form).
- AC: Webhook Midtrans mengupdate status *plan* tenant secara otomatis menjadi aktif jika berhasil dibayar.
- AC: Tenant dapat melihat daftar *Invoices* / riwayat pembayarannya.

**US-11.2** Sebagai Tenant Admin, saya ingin memantau limit penggunaan resource bulanan.
- AC: Tersedia indikator bar (persentase) untuk penggunaan API requests bulanan.
- AC: Tersedia indikator bar untuk penggunaan R2 Storage capacity.

#### Epic 12: Audit Logging & Monitoring

**US-12.1** Sebagai Tenant Admin, saya ingin melihat rekaman jejak semua perubahan di workspace saya.
- AC: Seluruh aksi krusial (Create/Update/Delete konten, pergantian Role, penghapusan token) dicatat.
- AC: Log mencatat: Siapa (User/System), Apa (Action), Kapan (Timestamp), dan Di Mana (IP/User-Agent).
- AC: Tabel *Audit Log* tersedia di dashboard admin.


### 2.3 Non-Goals (v1.0)

| #   | Non-Goal                          | Alasan                                                                                                      |
| --- | --------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| 1   | Self-hosted deployment            | Fokus SaaS-first; self-hosted di v2.0                                                                       |
| 2   | Plugin marketplace UI             | v1.0 hanya webhook hooks; marketplace di v2.0                                                               |
| 3   | Real-time collaborative editing   | Complexity tinggi; di v2.0 dengan CRDT                                                                      |
| 4   | White-label / custom domain       | Enterprise feature; di v1.1                                                                                 |
| 5   | Database agnostic (MySQL, SQLite) | PostgreSQL only; focus vs fragmentation                                                                     |
| 6   | Mobile app                        | Web-first; mobile SDK prioritized over native app                                                           |
| 7   | A/B testing konten                | Marketing feature; di v2.0                                                                                  |
| 8   | ~~AI content generation~~         | ~~Perlu riset model; di v1.1~~ → **Sudah diimplementasi** (OpenAI integration, schema generator, templates) |

---

## 3. Technical Specifications

### 3.1 Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        SACMS v1.0                         │
│                                                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐      │
│  │  Admin    │  │  Tenant  │  │  Public  │  │  Webhook │      │
│  │  Panel    │  │ Dashboard│  │  API     │  │  Engine  │      │
│  │  (SSR)    │  │  (SSR)   │  │(REST+GQL)│  │          │      │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘      │
│       │              │              │              │            │
│  ┌────┴──────────────┴──────────────┴──────────────┴────┐      │
│  │              Next.js 16 App Router                    │      │
│  │         (API Routes + Server Components)              │      │
│  └────┬──────────────┬──────────────┬───────────────────┘      │
│       │              │              │                           │
│  ┌────┴────┐  ┌──────┴──────┐  ┌───┴───┐                     │
│  │ Prisma  │  │  Media Svc  │  │ Redis │                     │
│  │  ORM    │  │  (S3/R2)    │  │ Cache │                     │
│  └────┬────┘  └──────┬──────┘  └───┬───┘                     │
│       │              │              │                           │
│  ┌────┴────┐  ┌──────┴──────┐  ┌───┴────────┐                │
│  │PostgreSQL│  │Cloudflare R2│  │ Rate Limit │                │
│  │  + FTS   │  │   + CDN     │  │ + Sessions │                │
│  └─────────┘  └─────────────┘  └────────────┘                │
└─────────────────────────────────────────────────────────────────┘

External:
  ├── Midtrans (Payment)
  ├── OAuth (Google, GitHub)
  └── Tenant Webhooks (outbound)
```

### 3.2 Database Schema Changes (vs Current)

#### ContentEntry — Tambah status workflow + locale

```prisma
model ContentEntry {
  id             String    @id @default(cuid())
  documentId     String?   // Group translations of the same entry
  contentTypeId  String
  tenantId       String?   // Optional for truly global/platform entries
  locale         String    @default("en")       // NEW: i18n
  data           Json
  status         ContentStatus @default(DRAFT)
  reviewComment  String?                         // Comment from reviewer on reject/approve
  publishedAt    DateTime?
  scheduledAt    DateTime?                       // NEW: scheduled publish
  archivedAt     DateTime?                       // NEW: archive tracking
  createdBy      String?
  updatedBy      String?                         // Last editor (User ID, no FK constraint)

  @@index([tenantId, contentTypeId, status])
  @@index([tenantId, locale])
  @@index([status, scheduledAt])                   // For cron scheduled publish
  @@index([documentId])                             // For i18n document grouping
  @@index([tenantId, status])
}

enum ContentStatus {
  DRAFT
  IN_REVIEW
  APPROVED
  SCHEDULED
  PUBLISHED
  ARCHIVED
  REJECTED
}
```

#### TenantLocale — i18n configuration per tenant

```prisma
model TenantLocale {
  id        String  @id @default(cuid())
  tenantId  String?
  locale    String  // e.g. "en", "id", "ja"
  name      String  // e.g. "English", "Bahasa Indonesia"
  isDefault Boolean @default(false)
  isEnabled Boolean @default(true)

  tenant Tenant? @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@unique([tenantId, locale])
  @@map("tenant_locales")
}
```

#### ContentTypeField — Tambah localizable flag

```prisma
model ContentTypeField {
  // ... existing fields ...
  localizable  Boolean @default(true)   // NEW: can this field be translated?
}
```

#### Media — Migrasi ke cloud URL

```prisma
model Media {
  id           String   @id @default(cuid())
  tenantId     String
  folderId     String?
  name         String
  originalName String
  mimeType     String
  size         Int      // in bytes
  url          String
  storageKey   String?  // S3/R2 object key (e.g., tenantId/2026/03/uuid.jpg)
  thumbnailUrl String?
  mediumUrl    String?  // Medium-size image URL (600px)
  alt          String?
  caption      String?
  width        Int?
  height       Int?
  isPrivate    Boolean  @default(false)
  metadata     Json?    // Native JSON for additional metadata
  uploadedBy   String?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  tenant       Tenant       @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  folder       MediaFolder? @relation(fields: [folderId], references: [id], onDelete: Cascade)

  @@index([tenantId, mimeType])
  @@map("media")
}
```

### 3.3 Public API Filtering Engine

Design pattern mengikuti Strapi's [Filtering API](https://docs.strapi.io/dev-docs/api/rest/filters) yang sudah dikenal developer:

```
GET /api/public/{tenant}/content/{type}
  ?filters[title][$contains]=next
  &filters[price][$gte]=100
  &filters[category][$eq]=tutorial
  &filters[$or][0][status][$eq]=featured
  &filters[$or][1][pinned][$eq]=true
  &fields=title,slug,price,category
  &populate=author,tags
  &locale=id
  &sort=createdAt:desc
  &pagination[page]=1
  &pagination[pageSize]=25
```

**Operator mapping ke PostgreSQL:**

| Operator      | SQL             | Contoh                                     |
| ------------- | --------------- | ------------------------------------------ |
| `$eq`         | `= value`       | `WHERE data->>'category' = 'tutorial'`     |
| `$ne`         | `!= value`      | `WHERE data->>'category' != 'tutorial'`    |
| `$gt`         | `> value`       | `WHERE (data->>'price')::numeric > 100`    |
| `$gte`        | `>= value`      | `WHERE (data->>'price')::numeric >= 100`   |
| `$lt`         | `< value`       | `WHERE (data->>'price')::numeric < 100`    |
| `$lte`        | `<= value`      | `WHERE (data->>'price')::numeric <= 100`   |
| `$contains`   | `ILIKE %value%` | `WHERE data->>'title' ILIKE '%next%'`      |
| `$startsWith` | `ILIKE value%`  | `WHERE data->>'title' ILIKE 'next%'`       |
| `$endsWith`   | `ILIKE %value`  | `WHERE data->>'title' ILIKE '%next'`       |
| `$in`         | `IN (values)`   | `WHERE data->>'category' IN ('a','b')`     |
| `$notIn`      | `NOT IN`        | `WHERE data->>'category' NOT IN ('a','b')` |
| `$null`       | `IS NULL`       | `WHERE data->>'image' IS NULL`             |
| `$notNull`    | `IS NOT NULL`   | `WHERE data->>'image' IS NOT NULL`         |
| `$or`         | `OR`            | Logical OR of conditions                   |
| `$and`        | `AND`           | Logical AND (default)                      |

**Security**: Semua filter values di-sanitize dan diparameterkan (no SQL injection). Filter hanya beroperasi pada field yang terdefinisi di content type schema.

### 3.4 Full-Text Search

Menggunakan **PostgreSQL built-in full-text search** (pg_tsvector) — zero additional infrastructure:

```sql
-- Migration: Add search vector column
ALTER TABLE "ContentEntry" ADD COLUMN "searchVector" tsvector;

-- Auto-update trigger
CREATE FUNCTION update_search_vector() RETURNS trigger AS $$
BEGIN
  NEW."searchVector" := to_tsvector('english',
    coalesce(NEW.data::text, '')
  );
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

CREATE TRIGGER content_search_update
  BEFORE INSERT OR UPDATE ON "ContentEntry"
  FOR EACH ROW EXECUTE FUNCTION update_search_vector();

-- GIN index for fast search
CREATE INDEX idx_content_search ON "ContentEntry" USING GIN ("searchVector");
```

API usage: `?search=next.js tutorial` → `WHERE "searchVector" @@ plainto_tsquery('english', 'next.js tutorial')`

### 3.5 Cloud Media Storage (Cloudflare R2)

Dipilih R2 karena: **zero egress fees**, S3-compatible API, integrated CDN.

```
Upload Flow:
  Client → POST /api/tenant/{t}/media (multipart/form-data)
    → Validate: size ≤ 10MB, MIME whitelist, magic bytes
    → Upload to R2: /{tenantId}/{year}/{month}/{uuid}.{ext}
    → If image: generate thumbnails (sharp)
       - thumbnail: 150px wide
       - medium: 600px wide
    → Save metadata to DB (URL, storageKey, dimensions)
    → Return: { url, thumbnailUrl, mediumUrl, mimeType, size }

Download Flow:
  Client → GET {cdnUrl}/{tenantId}/{year}/{month}/{uuid}.jpg
    → Cloudflare CDN serves file (edge cached)
    → No database query needed
```

**MIME Whitelist:**

| Kategori | Types                                                                   |
| -------- | ----------------------------------------------------------------------- |
| Image    | image/jpeg, image/png, image/gif, image/webp, image/svg+xml, image/avif |
| Video    | video/mp4, video/webm                                                   |
| Audio    | audio/mpeg, audio/wav, audio/ogg                                        |
| Document | application/pdf                                                         |

### 3.6 Content Hooks (Webhook v2)

Evolusi dari webhook system yang ada. Tambah **synchronous hooks** yang bisa memodifikasi data:

```
Hook Lifecycle:

  Client Request (Create Entry)
        │
        ▼
  ┌─ content.beforeCreate ┤  Can modify data or reject (return error), 5s timeout
  │                       │
  ├─ [Database Write]     ┤
  │                       │
  ├─ content.created      ┤  Notification only (async, 10s timeout)
  │                    │
  └─ Response ─────────┘
```

| Hook                    | Sync/Async | Can Modify | Can Reject | Timeout |
| ----------------------- | ---------- | ---------- | ---------- | ------- |
| `content.beforeCreate`  | Sync       | ✅ Data    | ✅         | 5s      |
| `content.created`       | Async      | ❌         | ❌         | 10s     |
| `content.beforeUpdate`  | Sync       | ✅ Data    | ✅         | 5s      |
| `content.updated`       | Async      | ❌         | ❌         | 10s     |
| `content.beforeDelete`  | Sync       | ❌         | ✅         | 5s      |
| `content.deleted`       | Async      | ❌         | ❌         | 10s     |
| `content.beforePublish` | Sync       | ✅ Data    | ✅         | 5s      |
| `content.published`     | Async      | ❌         | ❌         | 10s     |

Sync hooks: webhook dipanggil dan response ditunggu (max 5 detik). Jika webhook mengembalikan `{ reject: true, message: "..." }`, operasi dibatalkan.

### 3.7 TypeScript SDK Design

```typescript
// Installation: npm install @sacms/sdk

import { SaCMS } from "@sacms/sdk";

const cf = new SaCMS({
  baseUrl: "https://api.sacms.dev",
  tenant: "my-workspace",
  token: "cf_xxxxx",
  locale: "id", // default locale
});

// Find many with filters
const articles = await cf.collection("articles").findMany({
  filters: {
    category: { $eq: "tutorial" },
    price: { $gte: 100 },
  },
  fields: ["title", "slug", "author"],
  populate: ["author", "tags"],
  locale: "en",
  sort: "createdAt:desc",
  pagination: { page: 1, pageSize: 25 },
});

// Find one
const article = await cf.collection("articles").findOne("clu1234xxx");

// Single type
const settings = await cf.single("homepage").find({ locale: "id" });

// GraphQL
const result = await cf.graphql(`
  query {
    articles(locale: "id", filters: { category: { eq: "tutorial" } }) {
      data {
        id
        title
        author { name }
      }
      meta { pagination { total } }
    }
  }
`);
```

### 3.8 Redis Integration

Kebutuhan Redis:

| Fitur              | Penggunaan                                                     |
| ------------------ | -------------------------------------------------------------- |
| Rate Limiting      | `INCR cf:ratelimit:{token}:{minute}` dengan TTL 60s            |
| Session Cache      | Cache JWT decoded payload (5 min TTL)                          |
| API Response Cache | Cache public GET responses (configurable TTL per content type) |
| Scheduled Jobs     | Pub/sub untuk scheduled publish trigger                        |
| Webhook Queue      | Queue outbound webhook deliveries                              |

Library: `@upstash/redis` — Edge-compatible Redis client (REST over HTTPS).

Fallback: Jika Redis tidak tersedia, fallback ke in-memory (development mode).

### 3.9 Integration Points

| System          | Protocol             | Tujuan                   |
| --------------- | -------------------- | ------------------------ |
| PostgreSQL      | TCP/5432             | Primary database         |
| Cloudflare R2   | HTTPS (S3 API)       | Media storage            |
| Redis           | HTTPS (Upstash REST) | Cache, rate limit, queue |
| Midtrans        | HTTPS                | Payment processing       |
| Google OAuth    | HTTPS                | Social login             |
| GitHub OAuth    | HTTPS                | Social login             |
| Tenant Webhooks | HTTPS (outbound)     | Event notifications      |

### 3.10 Security & Privacy

| Concern              | Mitigation                                                                                                                                                          |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Input Validation** | Zod schemas di setiap API route — reject invalid data sebelum hit DB                                                                                                |
| **SQL Injection**    | Prisma ORM parameterized queries; raw queries hanya untuk FTS dengan parameterized values                                                                           |
| **XSS**              | DOMPurify sanitize semua rich text sebelum simpan; CSP header                                                                                                       |
| **CSRF**             | SameSite cookies + CSRF token di state-changing endpoints                                                                                                           |
| **File Upload**      | Magic byte validation + MIME whitelist + size limit + virus scan (ClamAV optional)                                                                                  |
| **Rate Limiting**    | Redis-based (Upstash) di semua endpoint; 1000 req/min public (plan-based: Free=100, Starter=500, Pro=1000, Enterprise=2000), 30 req/min auth, 300 req/min dashboard |
| **Secrets**          | Environment variables only; tidak ada `.env` di repository; HashiCorp Vault untuk production                                                                        |
| **Data Privacy**     | Tenant data isolation via tenantId; GDPR deletion endpoint; encrypted PII fields                                                                                    |
| **API Token**        | Prefix `cf_`, SHA-256 hashed in DB for O(1) lookup, last-used tracking, expiration support                                                                                           |
| **Security Headers** | CSP, X-Frame-Options: DENY, HSTS, X-Content-Type-Options: nosniff                                                                                                   |

---

## 4. Competitive Analysis: SaCMS vs Market

### 4.1 Feature Comparison Matrix

| Feature                  | Strapi         | Contentful | Sanity    | Payload CMS | **SaCMS**                        |
| ------------------------ | -------------- | ---------- | --------- | ----------- | -------------------------------- |
| **Open Source**          | ✅             | ❌         | ❌        | ✅          | ❌ (SaaS)                        |
| **Multi-Tenant Native**  | ❌             | ❌         | ❌        | ❌          | ✅                               |
| **Billing Built-in**     | ❌             | ❌         | ❌        | ❌          | ✅                               |
| **Payment Gateway (ID)** | ❌             | ❌         | ❌        | ❌          | ✅ (Midtrans)                    |
| **Content Workflow**     | ✅ (plugin)    | ✅         | ✅        | ✅          | ✅                               |
| **i18n Content**         | ✅ (plugin)    | ✅         | ✅        | ✅          | ✅                               |
| **GraphQL**              | ✅             | ✅         | ✅ (GROQ) | ✅          | ✅                               |
| **REST API**             | ✅             | ✅         | ❌        | ✅          | ✅                               |
| **Advanced Filtering**   | ✅             | ✅         | ✅ (GROQ) | ✅          | ✅                               |
| **Full-text Search**     | ❌ (plugin)    | ✅         | ✅        | ❌          | ✅ (PostgreSQL)                  |
| **Webhooks**             | ✅             | ✅         | ✅        | ✅          | ✅ (sync + async)                |
| **Sync Hooks**           | ✅ (lifecycle) | ❌         | ❌        | ✅          | ✅                               |
| **TypeScript SDK**       | ❌             | ✅         | ✅        | ✅          | ✅                               |
| **Content Versioning**   | ✅             | ✅         | ✅        | ✅          | ✅                               |
| **Media CDN**            | ❌ (self)      | ✅         | ✅        | ❌          | ✅ (R2)                          |
| **Team Management**      | ✅             | ✅         | ✅        | ✅          | ✅                               |
| **Audit Log**            | ❌             | ✅         | ✅        | ✅          | ✅                               |
| **Self-Hosted Option**   | ✅             | ❌         | ❌        | ✅          | ❌ (SaaS-first, Docker tersedia) |

### 4.2 SaCMS Unique Advantages

1. **Multi-Tenant Native** — Satu-satunya headless CMS yang natively mendukung multi-workspace tanpa konfigurasi tambahan
2. **Payment Integration (Indonesia)** — Midtrans built-in, cocok untuk pasar Southeast Asia
3. **Synchronous Hooks** — Webhook yang bisa memodifikasi data sebelum disimpan (hanya Strapi lifecycle dan Payload yang punya ini)
4. **Zero-Config** — Tidak perlu hosting, database setup, atau DevOps. Sign up → create workspace → start building

---

## 5. Risks & Roadmap

### 5.1 Phased Rollout

#### Phase 1: MVP Foundation (Sprint 1-2, 4 minggu)

| #   | Deliverable                                                  | Priority    |
| --- | ------------------------------------------------------------ | ----------- |
| 1   | Content Workflow (status enum, draft/review/publish/archive) | 🔴 Critical |
| 2   | Cloud Media Storage (Cloudflare R2 + thumbnails)             | 🔴 Critical |
| 3   | Input validation (Zod) di semua API routes                   | 🔴 Critical |
| 4   | Security hardening (CSRF, headers, secrets management)       | 🔴 Critical |
| 5   | Advanced REST Filtering Engine                               | 🔴 Critical |
| 6   | Field selection & relation populate                          | 🔴 Critical |
| 7   | Redis integration (rate limiting, cache)                     | 🟠 High     |
| 8   | Remove debug logging, consolidate editors                    | 🟠 High     |

**Gate Criteria:** Semua API terproteksi, media via R2, filtering berfungsi, content workflow E2E.

#### Phase 2: Developer Experience (Sprint 3-4, 4 minggu)

| #   | Deliverable                                                      | Priority    |
| --- | ---------------------------------------------------------------- | ----------- |
| 9   | i18n Content Management (locale per entry, multilanguage editor) | 🔴 Critical |
| 10  | GraphQL Mutations (create, update, delete, publish)              | 🟠 High     |
| 11  | Full-text Search (pg_tsvector)                                   | 🟠 High     |
| 12  | TypeScript SDK (@sacms/sdk)                                      | 🟠 High     |
| 13  | Scheduled publishing (cron-based)                                | 🟠 High     |
| 14  | Synchronous content hooks                                        | 🟡 Medium   |

**Gate Criteria:** SDK usable, i18n functional, search < 200ms, GraphQL mutations tested.

#### Phase 3: Production Readiness (Sprint 5-6, 4 minggu)

| #   | Deliverable                               | Priority  |
| --- | ----------------------------------------- | --------- |
| 15  | Unit & integration tests (≥ 50% coverage) | 🟠 High   |
| 16  | CI/CD pipeline (GitHub Actions)           | 🟠 High   |
| 17  | Error monitoring (Sentry)                 | 🟠 High   |
| 18  | Dockerize (docker-compose for dev)        | 🟡 Medium |
| 19  | API documentation (OpenAPI/Swagger)       | 🟡 Medium |
| 20  | Database backup strategy                  | 🟡 Medium |
| 21  | Performance optimization & load testing   | 🟡 Medium |

**Gate Criteria:** Tests passing, CI green, Sentry integrated, API docs published, < 200ms P95 latency.

#### Phase 4: v1.1 Enhancements (Post-Launch)

| #   | Deliverable                                          |
| --- | ---------------------------------------------------- | -------------------------------------------------------------------------- |
| 22  | AI Content Generation (OpenAI integration)           |
| 23  | White-label & custom domain per tenant               |
| 24  | Payment gateway abstraction (support Stripe, Xendit) |
| 25  | API versioning (v1, v2)                              |
| 26  | Content approval workflow (multi-reviewer)           |
| 27  | ~~Webhook retry policy & dead letter queue~~         | **Sudah diimplementasi** di Phase 2 (exponential backoff, DLQ, cron retry) |

### 5.2 Technical Risks

| Risk                                       | Probability | Impact | Mitigation                                                                           |
| ------------------------------------------ | ----------- | ------ | ------------------------------------------------------------------------------------ |
| **PostgreSQL FTS performance at scale**    | Medium      | High   | Benchmark di 100K entries; fallback ke Meilisearch jika P95 > 500ms                  |
| **R2 upload failures**                     | Low         | High   | Retry with exponential backoff; fallback ke local disk temporarily                   |
| **Redis single point of failure**          | Medium      | Medium | Graceful fallback ke in-memory; Redis Sentinel untuk HA                              |
| **Solo dev bottleneck**                    | High        | High   | Prioritize ruthlessly; skip non-critical features; use code generation               |
| **Sync hook latency**                      | Medium      | Medium | Hard timeout 5s; circuit breaker after 3 failures; disable faulty hooks              |
| **Migration from base64 media**            | Low         | High   | Backward-compatible: support both base64 (legacy) dan R2 URL; batch migration script |
| **Prisma raw query untuk advanced filter** | Medium      | Medium | Parameterized queries only; Zod validate filter input; unit test semua operators     |

### 5.3 Infrastructure Cost Estimate (Solo, Early Stage)

| Service        | Provider                    | Est. Cost/Month    |
| -------------- | --------------------------- | ------------------ |
| PostgreSQL     | Supabase / Neon (free tier) | $0 - $25           |
| Redis          | Upstash (free tier)         | $0 - $10           |
| Object Storage | Cloudflare R2 (10GB free)   | $0 - $5            |
| Hosting        | Vercel (hobby → pro)        | $0 - $20           |
| Domain + SSL   | Cloudflare                  | $10/year           |
| Monitoring     | Sentry (free tier)          | $0                 |
| CI/CD          | GitHub Actions (free tier)  | $0                 |
| **Total**      |                             | **$0 - $60/month** |

---

## 6. Implementation Guidelines

### DO (Always)

- **Validate first**: Setiap API route HARUS memiliki Zod schema. Tidak ada `request.json()` tanpa validasi.
- **Test critical paths**: Auth, content CRUD, payment, dan public API wajib punya integration tests.
- **Security by default**: Rate limiting, CSRF, input validation, output sanitization di setiap endpoint.
- **Type-safe**: Gunakan TypeScript strict mode, Prisma generated types, dan Zod inferred types.
- **Migrate incrementally**: Base64 media harus tetap berfungsi selama transisi ke R2; backward compatible.

### DON'T (Avoid)

- **Don't over-engineer**: Plugin marketplace bukan prioritas. Webhook hooks sudah cukup untuk v1.0.
- **Don't support multiple databases**: PostgreSQL only. Focus wins over fragmentation.
- **Don't build custom auth**: NextAuth sudah battle-tested. Tidak perlu custom JWT implementation.
- **Don't skip validation**: Zod sudah terpasang. Gunakan di SETIAP route handler.
- **Don't store secrets in code**: Semua secrets via environment variables. Tidak ada hardcoded values.

---

_PRD ini akan di-review dan di-update seiring development berlangsung._

---

## 7. Detailed CRUD Specifications

Bagian ini mendeskripsikan secara eksplisit kontrak CRUD (Create, Read, Update, Delete) untuk entitas-entitas utama di dalam sistem. Seluruh interaksi state-changing menggunakan **Server Actions** pada *Dashboard*, dan **REST API / GraphQL** pada *Public API*.

### 7.1 Tenant & Workspace Management
- **Create**:
  - `POST /api/tenants` (Internal) -> `db.tenant.create()`.
  - Membuat record Tenant, memberikan Role `owner` kepada creator di `TenantMember`, mengeset plan default (e.g. `free`), dan memicu *provisioning* konfigurasi awal.
- **Read**:
  - `GET /api/tenants` -> Mendapatkan daftar tenant yang diakses user (`session.user.tenants`).
  - Divalidasi via `getTenantAccess(session, tenantSlug)`.
- **Update**:
  - `PUT /api/tenant/[tenant]/settings` -> `db.tenant.update()`.
  - Mengubah nama, custom domain, atau preferensi lokalisasi.
- **Delete**:
  - `DELETE /api/tenants/[tenantId]` -> `db.tenant.delete()`.
  - Cascading delete akan menghapus seluruh `ContentEntry`, `ContentType`, `Media`, dan data tenant terkait (isolasi penuh).

### 7.2 Content Types (Schema Builder)
- **Create**:
  - Server Action: `createContentTypeAction(tenantSlug, data)`.
  - Payload: `name`, `slug`, `description`, `fields` (Array dari objects yang berisi name, slug, type, required, options).
  - Validasi: Zod `createContentTypeSchema`. Mengecek limit plan (`enforcePlanLimit`).
  - Jika relasi, maka field akan disimpan sebagai JSON dengan metadata referensi.
- **Read**:
  - Action: `getContentTypesAction(tenantSlug)`. Mengembalikan content types beserta jumlah entries (`entryCount`).
  - Action: `getContentTypeBySlugAction(tenantSlug, slug)`.
- **Update**:
  - Action: `updateContentTypeAction(tenantSlug, id, data)`.
  - Menghapus ulang seluruh field yang ada di relasi `ContentTypeField` lalu membuat ulang berdasarkan array fields yang baru (transactional delete-and-create).
- **Delete**:
  - Action: `deleteContentTypeAction(tenantSlug, id)`.
  - Validasi tidak boleh menghapus *global content types* jika bukan Super Admin. Cascading delete semua entry yang berada di bawah Content Type ini.

### 7.3 Content Entries (Draft / Publish Workflow)
- **Create**:
  - Action: `createEntryAction(tenantSlug, contentTypeId, data, locale, status)`.
  - Data JSON dinamis dari field editor disimpan dalam kolom `data` (Tipe data Prisma: `Json`).
  - Workflow Status di-*inject* (`DRAFT` atau `PUBLISHED`).
  - Trigger webhook (jika aktif): `content.created` secara async.
- **Read**:
  - **Admin**: Action `getEntriesAction(tenantSlug, contentTypeId, page, pageSize, search)`.
  - **Public API**: `GET /api/public/[tenant]/content/[slug]`. 
    - Wajib menggunakan valid `Authorization: Bearer <token>`.
    - Mendukung filter operator Strapi-style (`$eq`, `$in`, `$contains`) via library `lib/filters.ts`.
    - Hanya mengembalikan entri dengan status `PUBLISHED`.
- **Update**:
  - Action: `updateEntryAction(tenantSlug, id, data, locale, status)`.
  - Jika mengubah status dari `DRAFT` menjadi `IN_REVIEW` atau `PUBLISHED`, fungsi validasi field wajib (*required*) akan dipicu. Jika statusnya `DRAFT`, field wajib boleh kosong.
- **Delete**:
  - Action: `deleteEntryAction(tenantSlug, id)`.
  - Menghapus record. Memicu webhook `content.deleted`.

### 7.4 Media Library
- **Create**:
  - `POST /api/tenant/[tenant]/media` menggunakan `FormData`.
  - Mengunggah file asli ke **Cloudflare R2** menggunakan `aws-sdk/client-s3` (Command `PutObjectCommand`).
  - Jika image, meng-generate thumbnail 150px dan 600px secara *on-the-fly* via canvas/sharp lalu disimpan ke R2.
  - DB Record: Menyimpan MIME, URL Publik, fileSize, dan metadata thumbnail.
- **Read**:
  - `GET /api/tenant/[tenant]/media`
  - Mendukung paginasi, folder structure (nested hierarchy), dan tipe file (image, document, video).
- **Update**:
  - `PATCH /api/tenant/[tenant]/media/[mediaId]`
  - Hanya merubah metadata (`alt text`, `caption`, file name), tidak merubah isi file R2.
- **Delete**:
  - `DELETE /api/tenant/[tenant]/media/[mediaId]`
  - Menghapus dari bucket S3 R2 terlebih dahulu, jika sukses baru menghapus record di DB.

### 7.5 API Tokens & Webhooks
- **API Token (Create)**:
  - Generate random token string.
  - Hash token dengan `SHA-256` menggunakan modul native `crypto` dari Node.js.
  - Simpan hanya versi HASH di dalam tabel `ApiToken` dengan identifier `token` yang memiliki index unik. Raw token hanya ditampilkan 1 kali ke user di UI.
- **API Token (Read/Verify)**:
  - Middleware / API Auth mengekstrak token dari Header `Authorization: Bearer <token>`.
  - Hash token yang diterima, lalu query ke DB `where: { token: hashedToken }`.
- **Webhook (CRUD)**:
  - Standar CRUD via `api/tenant/[tenant]/webhooks`.
  - **Execution**: Mengirim `POST` secara asynchronous ke target URL. Jika gagal (misal 500 error dari target), masukkan payload ke **Dead Letter Queue (DLQ)**.
  - DLQ akan di-retry menggunakan *Cron Job* `api/cron/webhook-retry` dengan eksponensial backoff.

### 7.6 State Machine Workflow Status
Berikut adalah transisi state yang diizinkan dalam Content Workflow:
1. `DRAFT` -> `IN_REVIEW` (Submit untuk di-review)
2. `IN_REVIEW` -> `APPROVED` atau ditolak kembali ke `DRAFT` (oleh Reviewer / Admin)
3. `APPROVED` -> `SCHEDULED` (Dijadwalkan via Cron `api/cron/publish`)
4. `APPROVED` / `DRAFT` -> `PUBLISHED` (Publish instan)
5. `PUBLISHED` -> `ARCHIVED` (Diarsipkan, hilang dari Public API)
Semua transisi divalidasi oleh fungsi `canRoleTransition` di dalam `lib/content-workflow.ts` dengan mempertimbangkan kapabilitas `Role` (Editor vs Admin).
