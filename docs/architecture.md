# System Architecture Document (SAD)

## 1. Overview
SaCMS adalah SaaS Headless CMS multi-tenant yang dibangun menggunakan arsitektur modern berbasis Edge dan Serverless. Dokumen ini menjelaskan rancangan teknis, tumpukan teknologi (tech stack), dan pola komunikasi antar komponen.

## 2. Technology Stack
- **Framework Utama:** Next.js 16 (App Router, Server Components, Server Actions)
- **Database:** PostgreSQL (Enterprise-ready)
- **ORM:** Prisma ORM
- **Cache & Rate Limiting:** Upstash Redis (Edge compatible)
- **Media Storage:** Cloudflare R2 (S3-compatible API)
- **Authentication:** NextAuth v4 (OAuth & Credentials) + Custom API Tokens (`cf_...`)
- **Pembayaran:** Midtrans Snap API
- **Styling UI:** TailwindCSS v4 + Radix UI (shadcn/ui)

## 3. High-Level Architecture
Sistem ini menggunakan arsitektur Monolithic-Serverless. Front-end (Admin Dashboard) dan Back-end (API Routes) berada dalam satu *codebase* Next.js, yang mana API routes dapat di-deploy sebagai Serverless Functions.

```text
[ Client / SPA / Mobile App ] <--- REST / GraphQL API ---> [ Next.js API Routes ]
                                                                  |
[ Tenant Admin / Dashboard ] <---- React Server Components ----> [ Next.js Core ]
                                                                  |
                                      +---------------------------+---------------------------+
                                      |                           |                           |
                                [ PostgreSQL ]               [ Redis ]                 [ Cloudflare R2 ]
                                (Main Database)           (Cache & Rate Limit)         (CDN Media Storage)
```

## 4. Pattern Desain Utama
### 4.1. Multi-Tenant Data Isolation
Setiap tabel krusial memiliki field `tenantId`. Akses database dibungkus menggunakan helper `getTenantDb(tenantId)` atau klausa `where: { tenantId }` yang sangat ketat untuk menghindari kebocoran data antar Workspace.

### 4.2. Advanced Filter Engine
Mengadopsi gaya Strapi (JSON-based filters). API menerima object filter seperti `filters[price][$gt]=100`, lalu modul `lib/filters.ts` akan mem-parsing dan menerjemahkannya menjadi Query Prisma yang aman (Parameterized SQL Injection safe).

### 4.3. Webhooks & Event-Driven
Menggunakan pola sinkron dan asinkron:
- **Sync Hooks:** Dieksekusi *sebelum* data masuk ke DB (contoh: `beforeCreate`). Dapat membatalkan mutasi.
- **Async Webhooks:** Dieksekusi *setelah* data berubah (contoh: `created`). Menggunakan *Dead Letter Queue* (DLQ) dan Cron Retries jika *endpoint* webhook tujuan mati.

## 5. Skema Database Inti (Prisma ERD Concept)
- **Tenant & User:** Relasi Many-to-Many via `TenantMember`.
- **Content Modeling:** `ContentType` (Tabel) memiliki banyak `ContentTypeField` (Kolom).
- **Content Data:** Data tersimpan dinamis dalam kolom tipe `JSONB` di tabel `ContentEntry`.
- **Media:** `Media` terhubung ke `MediaFolder` dan `Tenant`, menggunakan penyimpanan R2 CDN.
- **Webhooks & API Tokens:** Tabel `Webhook`, `WebhookLog`, `ApiToken` dengan relasi kuat ke `Tenant`.

## 6. Codebase Structure & Modules
Aplikasi terbagi dalam direktori-direktori inti:
- **`src/app/api/public/`**: Endpoint REST API untuk konsumsi frontend eksternal (Read-only, terproteksi API Token).
- **`src/app/api/tenant/`**: Internal API untuk modul administrasi Tenant (Media upload, Stripe webhook, System logs).
- **`src/app/admin/` & `src/app/dashboard/`**: UI panel administrasi dibangun dengan Next.js Server Components.
- **`src/actions/`**: Modul Server Actions untuk *mutations* data (Create, Update, Delete) yang di-*trigger* dari UI, mendukung progresif enhancement dan revalidasi cache.
- **`src/lib/`**: Utilitas *core* seperti mesin `filters.ts`, `database.ts` (Prisma Singleton), `rate-limit.ts` (Upstash Redis), dan `r2.ts`.

## 7. Quality Assurance (Testing & CI/CD)
Arsitektur dirancang agar siap diuji (*testable*):
- **Unit Tests:** Memastikan logika filter, role transitions, dan utility functions berjalan benar via `Vitest`.
- **E2E Tests:** Menggunakan `Playwright`. Sesi *mock login* diinisialisasi melalui `global-setup.ts` dengan tenant *Enterprise* untuk mencegah interupsi limit plan selama pengujian asinkron. Pipeline pengujian ini siap diintegrasikan dengan GitHub Actions.
