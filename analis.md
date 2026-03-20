# Analisis Sistem SACMS (ContentFlow)

**Tanggal Analisis:** 15 Maret 2026
**Versi Sistem:** 0.2.0
**Nama Produk:** ContentFlow — SaaS Headless CMS Platform

---

## Daftar Isi

1. [Ringkasan Eksekutif](#1-ringkasan-eksekutif)
2. [Arsitektur Sistem](#2-arsitektur-sistem)
3. [Tech Stack Lengkap](#3-tech-stack-lengkap)
4. [Skema Database](#4-skema-database)
5. [Peta API](#5-peta-api)
6. [Peta Halaman](#6-peta-halaman)
7. [Fitur Utama](#7-fitur-utama)
8. [Analisis Keamanan](#8-analisis-keamanan)
9. [Analisis SWOT](#9-analisis-swot)
10. [Rekomendasi](#10-rekomendasi)
11. [Statistik Proyek](#11-statistik-proyek)

---

## 1. Ringkasan Eksekutif

**ContentFlow** adalah platform SaaS Headless CMS multi-tenant yang dibangun menggunakan Next.js 16 App Router. Sistem ini dirancang untuk memungkinkan pengelolaan konten secara terpusat oleh **Super Admin**, lalu didistribusikan ke berbagai **Tenant (workspace)** yang masing-masing memiliki tim, konten, media, dan konfigurasi sendiri. Konten yang dikelola oleh tenant dapat diakses secara publik melalui **REST API** dan **GraphQL API** menggunakan token autentikasi.

### Tujuan Bisnis

- Menyediakan platform CMS-as-a-Service untuk berbagai organisasi
- Monetisasi melalui model langganan bertingkat (Free, Starter, Pro, Enterprise)
- Integrasi pembayaran lokal Indonesia via Midtrans (GoPay, ShopeePay, QRIS, Bank Transfer, Kartu Kredit)

### Alur Utama

```
Super Admin → Buat Content Types/Single Types/Components
    ↓
Super Admin → Assign ke Tenant
    ↓
Tenant Admin → Kelola Konten, Media, Tim, Webhook
    ↓
Public API → Konsumsi konten via REST/GraphQL (token auth)
```

### Status Pengembangan

Sistem telah melewati 12 tahap pengembangan utama (tercatat di `worklog.md`):

| Tahap | Status |
|-------|--------|
| Manajemen Content Types | ✅ Selesai |
| Manajemen Single Types | ✅ Selesai |
| Manajemen Components | ✅ Selesai |
| Assignment ke Tenant | ✅ Selesai |
| Content API (tenant-isolated) | ✅ Selesai |
| Manajemen Tim/Member | ✅ Selesai |
| Public Content Delivery API | ✅ Selesai |
| API Token Management | ✅ Selesai |
| Webhook System (HMAC-SHA256) | ✅ Selesai |
| Tenant Settings | ✅ Selesai |
| Integrasi Midtrans Payment | ✅ Selesai |
| Super Admin dashboard & monitoring | ✅ Selesai |

---

## 2. Arsitektur Sistem

### 2.1 Pola Arsitektur

| Aspek | Pilihan |
|-------|---------|
| **Framework** | Next.js 16 App Router (React Server Components) |
| **Rendering** | Server-side rendering + Client components |
| **Database** | PostgreSQL via Prisma 6 ORM |
| **Authentication** | NextAuth.js 4.24 (JWT strategy) |
| **Deployment** | Standalone output (Bun runtime), Vercel-compatible |
| **Reverse Proxy** | Caddy (port 81 → Next.js 3000, WebSocket 3003) |

### 2.2 Multi-Tenancy Model

Sistem menggunakan **shared database, shared schema** dengan isolasi berbasis `tenantId` pada data:

```
┌─────────────────────────────────────────────┐
│                 PostgreSQL                   │
│                                             │
│  ┌─────────┐   ┌─────────┐   ┌─────────┐  │
│  │ Tenant A │   │ Tenant B │   │ Tenant C │  │
│  │ entries  │   │ entries  │   │ entries  │  │
│  │ media    │   │ media    │   │ media    │  │
│  │ members  │   │ members  │   │ members  │  │
│  └─────────┘   └─────────┘   └─────────┘  │
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │     Global (shared across tenants)   │   │
│  │  Content Types, Single Types,        │   │
│  │  Components, Users, Permissions      │   │
│  └─────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
```

Content Types, Single Types, dan Components dibuat secara **global** oleh Super Admin, kemudian **di-assign** ke tenant melalui junction table (`TenantContentTypeAssignment`, `TenantSingleTypeAssignment`, `TenantComponentAssignment`). Data konten (entries) bersifat **tenant-isolated** — setiap tenant hanya dapat melihat dan mengelola data miliknya sendiri.

### 2.3 Hierarki Akses

Sistem memiliki 3 level akses utama:

| Level | Role | Akses |
|-------|------|-------|
| **Sistem** | `super_admin` | Seluruh sistem — semua tenant, semua konfigurasi, billing |
| **Tenant** | `owner`, `admin`, `editor`, `viewer` | Terbatas pada tenant yang di-assign |
| **Publik** | API Token (Bearer) | Hanya konten published via REST/GraphQL |

### 2.4 Alur Autentikasi

```
Login → NextAuth Credentials/OAuth
  ↓
JWT Token dibuat (berisi: id, role, tenants[])
  ↓
Setiap request API → verifikasi session via getServerSession()
  ↓
Tenant routes → getTenantAccess() cek membership atau super_admin bypass
  ↓
Public routes → validasi API Token (header Authorization: Bearer cf_xxx)
```

- **Password**: Bcrypt dengan 12 salt rounds
- **Legacy Migration**: Password lama (simple hash) otomatis di-upgrade ke bcrypt saat login berhasil
- **OAuth**: Google dan GitHub (opsional, tergantung env vars)
- **First User**: User pertama yang register otomatis menjadi `super_admin`

### 2.5 Deployment Architecture

```
Internet → Caddy (port 81)
              ├─→ Next.js App (port 3000) — SSR + API
              └─→ WebSocket Server (port 3003) — real-time (contoh)

Next.js App → PostgreSQL (port 5432)
           → Midtrans API (sandbox/production)

Vercel Cron → POST /api/admin/billing/generate-invoices (daily 00:00 UTC)
```

---

## 3. Tech Stack Lengkap

### 3.1 Core Framework

| Teknologi | Versi | Fungsi |
|-----------|-------|--------|
| Next.js | 16.x | App Router, SSR, API Routes |
| React | 19.x | UI rendering |
| TypeScript | 5.x | Type safety |
| Prisma | 6.x | ORM & database migrations |
| PostgreSQL | - | Database utama |

### 3.2 UI & Styling

| Teknologi | Fungsi |
|-----------|--------|
| Tailwind CSS 4 | Utility-first CSS |
| shadcn/ui (Radix UI) | Component library (Button, Card, Dialog, Table, Badge, dsb) |
| Lucide React | Icon library |
| Framer Motion | Animasi |
| tailwindcss-animate | Animasi CSS |
| class-variance-authority | Variant styling |
| clsx + tailwind-merge | Conditional class merging |
| next-themes | Dark/light mode |

### 3.3 Editor & Konten

| Teknologi | Fungsi |
|-----------|--------|
| React Quill | Rich text editor (WYSIWYG) |
| CKEditor 5 | Rich text editor alternatif |
| MDX Editor | Markdown + JSX editor |
| @mdxeditor/editor | MDX editing UI |

### 3.4 State Management & Data Fetching

| Teknologi | Fungsi |
|-----------|--------|
| TanStack React Query | Server state management |
| Zustand | Client state management |
| React Hook Form | Form management |
| Zod | Schema validation (terpasang, belum digunakan) |

### 3.5 Autentikasi & Keamanan

| Teknologi | Fungsi |
|-----------|--------|
| NextAuth.js 4.24 | Authentication (Credentials, Google, GitHub) |
| bcryptjs | Password hashing (12 rounds) |

### 3.6 Payment & Billing

| Teknologi | Fungsi |
|-----------|--------|
| midtrans-client | Payment gateway Indonesia |
| - | Metode: GoPay, ShopeePay, QRIS, Bank Transfer, Kartu Kredit |

### 3.7 Utilitas

| Teknologi | Fungsi |
|-----------|--------|
| date-fns | Manipulasi tanggal |
| uuid | Unique ID generation |
| Recharts | Grafik & visualisasi data |
| @dnd-kit | Drag-and-drop (field ordering) |
| Sonner | Toast notifications |
| next-intl | Internationalization |
| Socket.IO | WebSocket (contoh real-time) |
| cmdk | Command palette |

### 3.8 Build & Development

| Teknologi | Fungsi |
|-----------|--------|
| Bun | JavaScript runtime (production) |
| ESLint | Code linting |
| PostCSS | CSS processing |
| Turbopack | Dev server bundler (Next.js) |

---

## 4. Skema Database

### 4.1 Ringkasan Model

Sistem memiliki **21+ model Prisma** yang dapat dikelompokkan sebagai berikut:

| Kelompok | Model | Jumlah |
|----------|-------|--------|
| **Auth & User** | User, Account, Session, VerificationToken | 4 |
| **Multi-Tenancy** | Tenant, TenantMember | 2 |
| **Content Types** | ContentType, ContentTypeField, TenantContentTypeAssignment | 3 |
| **Content Data** | ContentEntry, ContentVersion | 2 |
| **Single Types** | SingleType, SingleTypeField, TenantSingleTypeAssignment | 3 |
| **Components** | Component, ComponentField, TenantComponentAssignment | 3 |
| **Media** | Media, MediaFolder | 2 |
| **Billing** | Subscription, Invoice, PaymentTransaction | 3 |
| **API** | ApiToken (ApiKey), Webhook, WebhookLog | 3 |
| **Monitoring** | AuditLog, ApiRequest, SystemMetric | 3 |
| **Konfigurasi** | Setting, Permission | 2 |

### 4.2 Diagram Relasi Utama

```
User (1) ──── (*) TenantMember (*) ──── (1) Tenant
                                              │
              ┌───────────────────────────────┤
              │               │               │
     ContentEntry      Subscription      MediaFolder
              │               │               │
     ContentVersion     Invoice          Media
                              │
                     PaymentTransaction

ContentType (1) ──── (*) ContentTypeField
      │
      └── (*) TenantContentTypeAssignment (*) ──── (1) Tenant

SingleType (1) ──── (*) SingleTypeField
      │
      └── (*) TenantSingleTypeAssignment (*) ──── (1) Tenant

Component (1) ──── (*) ComponentField
      │
      └── (*) TenantComponentAssignment (*) ──── (1) Tenant
```

### 4.3 Detail Model Kritis

#### User

| Field | Type | Keterangan |
|-------|------|------------|
| id | String (cuid) | Primary key |
| name | String? | Nama user |
| email | String (unique) | Email login |
| password | String? | Bcrypt hash (null untuk OAuth) |
| role | String (default: "user") | `super_admin`, `admin`, `user` |
| emailVerified | DateTime? | Verifikasi email |

#### Tenant

| Field | Type | Keterangan |
|-------|------|------------|
| id | String (cuid) | Primary key |
| name | String | Nama workspace |
| slug | String (unique) | URL identifier |
| description | String? | Deskripsi |
| logo | String? | URL logo |
| plan | String (default: "free") | `free`, `starter`, `pro`, `enterprise` |
| status | String (default: "active") | `active`, `suspended`, `inactive` |

#### TenantMember

| Field | Type | Keterangan |
|-------|------|------------|
| userId | String | FK → User |
| tenantId | String | FK → Tenant |
| role | String (default: "viewer") | `owner`, `admin`, `editor`, `viewer` |

#### ContentType

| Field | Type | Keterangan |
|-------|------|------------|
| id | String (cuid) | Primary key |
| name | String | Nama content type |
| slug | String (unique) | Identifier |
| description | String? | Deskripsi |
| isPublished | Boolean | Status publikasi |
| fields | ContentTypeField[] | Definisi field |

#### ContentEntry

| Field | Type | Keterangan |
|-------|------|------------|
| id | String (cuid) | Primary key |
| contentTypeId | String | FK → ContentType |
| tenantId | String | FK → Tenant (isolasi data) |
| data | Json | Data konten (dynamic) |
| status | String | Draft, Published, Archived |
| publishedAt | DateTime? | Waktu publish |
| createdBy | String? | FK → User |

#### ContentVersion

| Field | Type | Keterangan |
|-------|------|------------|
| id | String (cuid) | Primary key |
| contentEntryId | String | FK → ContentEntry |
| version | Int | Nomor versi |
| data | Json | Snapshot data |
| changes | Json? | Detail perubahan |
| createdBy | String? | FK → User |

### 4.4 Tipe Field yang Didukung (23 tipe)

| Kategori | Tipe |
|----------|------|
| **Basic** | `text`, `textarea`, `richText` |
| **Number** | `integer`, `decimal`, `biginteger`, `float` |
| **Date & Time** | `date`, `time`, `datetime`, `timestamp` |
| **Selection** | `enumeration`, `select` |
| **Boolean** | `boolean` |
| **Validation** | `email`, `password`, `uid` |
| **Media** | `media`, `mediaMultiple` |
| **Relations** | `relation`, `component` |
| **Advanced** | `json`, `color`, `location` |

Setiap field memiliki properti: `name`, `slug`, `type`, `required`, `unique`, `options` (JSON), `jsonPath`, `relationSlug`, `order`.

---

## 5. Peta API

### 5.1 Ringkasan

| Modul | Endpoint | Metode Total |
|-------|----------|--------------|
| Auth | 3 route | 4 |
| Admin | 18+ route | 30+ |
| Tenant | 30+ route | 50+ |
| Public | 3 route | 3 |
| Payment | 3 route | 3 |
| Utility | 3 route | 3 |
| **Total** | **~62 route** | **~93+ metode** |

### 5.2 Auth Routes (`/api/auth/`)

| Route | Method | Fungsi |
|-------|--------|--------|
| `/api/auth/[...nextauth]` | GET, POST | NextAuth session management |
| `/api/auth/register` | POST | Registrasi user + rate limiting |
| `/api/auth/check-first-user` | GET | Cek apakah sudah ada user di sistem |

### 5.3 Admin Routes (`/api/admin/`)

Hanya dapat diakses oleh `super_admin`.

#### Content Type Management

| Route | Method | Fungsi |
|-------|--------|--------|
| `/api/admin/content-types` | GET, POST | List/buat content type |
| `/api/admin/content-types/[id]` | GET, PUT, DELETE | Detail/update/hapus content type |
| `/api/admin/single-types` | GET, POST | List/buat single type |
| `/api/admin/single-types/[id]` | GET, PUT, DELETE | Detail/update/hapus single type |
| `/api/admin/components` | GET, POST | List/buat component |
| `/api/admin/components/[id]` | GET, PUT, DELETE | Detail/update/hapus component |

#### User & Tenant Management

| Route | Method | Fungsi |
|-------|--------|--------|
| `/api/admin/users` | GET, POST | List semua user / buat user |
| `/api/admin/tenants` | GET | List semua tenant + statistik |
| `/api/admin/tenants/[tenantId]/content-types/[contentTypeId]` | GET, POST, DELETE | Assign/unassign content type ke tenant |
| `/api/admin/tenants/[tenantId]/components/[componentId]` | GET, POST, DELETE | Assign/unassign component ke tenant |

#### Konfigurasi & Monitoring

| Route | Method | Fungsi |
|-------|--------|--------|
| `/api/admin/api-tokens` | GET, POST | Kelola API token global |
| `/api/admin/settings` | GET, PUT | Konfigurasi sistem |
| `/api/admin/media` | GET, POST | Media library admin |
| `/api/admin/rbac/permissions` | GET | List permission (auto-seed) |
| `/api/admin/rbac/roles` | GET, POST | Kelola role |
| `/api/admin/stats` | GET | Statistik sistem keseluruhan |
| `/api/admin/billing/stats` | GET | Revenue, MRR, ARR |
| `/api/admin/billing/generate-invoices` | POST | Cron: generate invoice bulanan |
| `/api/admin/monitoring/metrics` | GET | CPU, memory, request count |
| `/api/admin/monitoring/requests` | GET | Log API request |

### 5.4 Tenant Routes (`/api/tenant/[tenant]/`)

Diakses oleh member tenant sesuai role, atau `super_admin` (bypass via `getTenantAccess`).

#### Content Management

| Route | Method | Fungsi |
|-------|--------|--------|
| `/api/tenant/[t]/content-types` | GET, POST | Content types yang di-assign ke tenant |
| `/api/tenant/[t]/content-types/[id]` | GET, PATCH, DELETE | Kelola content type |
| `/api/tenant/[t]/content-types/slug/[slug]` | GET | Get content type by slug |
| `/api/tenant/[t]/content-types/slug/[slug]/entries` | GET, POST | List/buat entry |
| `/api/tenant/[t]/content-types/slug/[slug]/entries/[id]` | GET, PATCH, DELETE | Kelola entry |
| `/api/tenant/[t]/single-types` | GET, POST, PUT | List/buat/update single type |
| `/api/tenant/[t]/single-types/[id]` | PATCH, DELETE | Update/hapus single type |
| `/api/tenant/[t]/single-types/slug/[slug]` | GET | Get single type by slug |
| `/api/tenant/[t]/components` | GET, POST | List/buat component |
| `/api/tenant/[t]/components/[id]` | PATCH, DELETE | Update/hapus component |
| `/api/tenant/[t]/components/slug/[slug]` | GET | Get component by slug |

#### Media & Konfigurasi

| Route | Method | Fungsi |
|-------|--------|--------|
| `/api/tenant/[t]/media` | GET, POST | Media library per tenant |
| `/api/tenant/[t]/settings` | GET, PUT | Pengaturan tenant |
| `/api/tenant/[t]/audit-logs` | GET | Log audit aktivitas |
| `/api/tenant/[t]/invoices` | GET | Daftar invoice |
| `/api/tenant/[t]/subscription` | GET | Info langganan aktif |

#### Tim & Akses

| Route | Method | Fungsi |
|-------|--------|--------|
| `/api/tenant/[t]/members` | GET, POST | List/undang member |
| `/api/tenant/[t]/members/[userId]` | PUT, DELETE | Update role/hapus member |
| `/api/tenant/[t]/api-tokens` | GET, POST | API token per tenant |
| `/api/tenant/[t]/api-tokens/[tokenId]` | GET, DELETE | Kelola token |

#### Webhook

| Route | Method | Fungsi |
|-------|--------|--------|
| `/api/tenant/[t]/webhooks` | GET, POST | List/buat webhook |
| `/api/tenant/[t]/webhooks/[webhookId]` | GET, PUT, DELETE | Kelola webhook |
| `/api/tenant/[t]/webhooks/[webhookId]/logs` | GET | Log eksekusi webhook |

#### Subscription

| Route | Method | Fungsi |
|-------|--------|--------|
| `/api/tenant/[t]/subscription/plan` | PATCH | Ubah plan langganan |
| `/api/tenant/[t]/subscription/cancel` | POST | Batalkan langganan |

### 5.5 Public API (`/api/public/[tenant]/`)

Diakses dengan **API Token** (header `Authorization: Bearer cf_xxx`).

| Route | Method | Fungsi |
|-------|--------|--------|
| `/api/public/[tenant]/content/[contentType]` | GET | Ambil semua entry (published) |
| `/api/public/[tenant]/single/[singleType]` | GET | Ambil data single type |
| `/api/public/[tenant]/graphql` | POST | Query GraphQL |

### 5.6 Payment Routes

| Route | Method | Fungsi |
|-------|--------|--------|
| `/api/checkout` | POST | Buat sesi pembayaran Midtrans |
| `/api/payment/[orderId]/status` | GET | Cek status transaksi |
| `/api/midtrans/webhooks` | POST | Notifikasi pembayaran dari Midtrans |

### 5.7 Utility Routes

| Route | Method | Fungsi |
|-------|--------|--------|
| `/api` | GET | Health check |
| `/api/categories` | GET | List kategori predefined |
| `/api/statuses` | GET | List status (Draft, Published, Archived) |

---

## 6. Peta Halaman

### 6.1 Halaman Publik

| Route | Fungsi |
|-------|--------|
| `/` | Landing page — hero, fitur, pricing, CTA |
| `/login` | Form login (email + password) |
| `/register` | Form registrasi (user pertama = super_admin) |
| `/docs` | Dokumentasi API — endpoint, contoh kode, GraphQL |
| `/dashboard` | Smart redirect: super_admin → `/admin`, tenant user → `/dashboard/[tenant]` |

### 6.2 Admin Dashboard (`/admin/`)

Hanya untuk `super_admin`.

| Route | Fungsi |
|-------|--------|
| `/admin` | Dashboard utama — statistik (tenant, user, revenue, content types) |
| `/admin/content-types` | List semua content type global |
| `/admin/content-types/[id]` | Edit content type + field builder |
| `/admin/single-types` | List semua single type global |
| `/admin/single-types/[id]` | Edit single type |
| `/admin/components` | List semua component global |
| `/admin/components/[id]` | Edit component |
| `/admin/api-tokens` | Manajemen tenant (tabel: nama, status, plan, member, API key, invoice, aksi) |
| `/admin/users` | Kelola semua user (search, role, tenant) |
| `/admin/rbac` | Role-Based Access Control (permissions, roles) |
| `/admin/billing` | Revenue stats: total, MRR, active subscriptions, pending invoices |
| `/admin/media` | Media library global |
| `/admin/monitoring` | Metrik sistem: CPU, memory, request, error rate |
| `/admin/settings` | Konfigurasi global |
| `/admin/[tenant]` | Redirect ke konfigurasi tenant |
| `/admin/[tenant]/rbac` | RBAC per tenant |

### 6.3 Tenant Dashboard (`/dashboard/[tenant]/`)

Untuk member tenant sesuai role.

| Route | Fungsi |
|-------|--------|
| `/dashboard/[tenant]` | Overview: content types, single types, components, members, media |
| `/dashboard/[tenant]/content-types` | Content types yang di-assign + jumlah entry |
| `/dashboard/[tenant]/content-types/[slug]` | List entry per content type |
| `/dashboard/[tenant]/content-types/[slug]/edit/[id]` | Edit entry individual |
| `/dashboard/[tenant]/single-types/[slug]` | Lihat data single type |
| `/dashboard/[tenant]/single-types/[slug]/edit` | Edit data single type |
| `/dashboard/[tenant]/components/[slug]` | Lihat component |
| `/dashboard/[tenant]/users` | Kelola tim (invite, role, hapus) |
| `/dashboard/[tenant]/api-keys` | Kelola API token tenant |
| `/dashboard/[tenant]/settings` | Pengaturan workspace |
| `/dashboard/[tenant]/webhooks` | Kelola webhook |
| `/dashboard/[tenant]/subscriptions` | Info langganan & plan |
| `/dashboard/[tenant]/subscriptions/checkout` | Halaman checkout upgrade plan |
| `/dashboard/[tenant]/subscriptions/payment/[orderId]` | Status pembayaran |
| `/dashboard/[tenant]/billing` | Informasi billing |

### 6.4 Global Dashboard Views

Halaman dashboard tanpa konteks tenant tertentu.

| Route | Fungsi |
|-------|--------|
| `/dashboard/content-types` | View content types global |
| `/dashboard/content-types/new` | Buat content type baru |
| `/dashboard/single-types` | View single types global |
| `/dashboard/components` | View components global |
| `/dashboard/api-keys` | API keys management |
| `/dashboard/users` | Semua user |
| `/dashboard/tenants` | List tenant |
| `/dashboard/settings` | Settings global |
| `/dashboard/monitoring` | Monitoring |
| `/dashboard/subscriptions` | Subscriptions overview |
| `/dashboard/billing` | Billing overview |

---

## 7. Fitur Utama

### 7.1 Content Type System

Inti dari ContentFlow. Super Admin mendefinisikan **Content Types** (collection type) secara global, kemudian meng-assign ke tenant. Setiap content type memiliki:

- **Field Builder** interaktif (drag-and-drop ordering)
- **23 tipe field** termasuk text, richText, media, relation, component, json, color, location
- **Validasi field**: required, unique
- **JSON Path** dan **Relation Slug** untuk field relasi
- Otomatis menghasilkan API endpoint per content type

### 7.2 Single Types

Mirip content type tetapi hanya memiliki **satu instance data** per tenant (seperti halaman About, Settings, Homepage). Cocok untuk konten yang tidak berulang.

- Data disimpan di junction table `TenantSingleTypeAssignment.data`
- Mendukung publish/unpublish per tenant
- Field builder sama dengan content type

### 7.3 Components (Reusable Field Groups)

Component adalah grup field yang dapat digunakan ulang di berbagai content type/single type:

- Dikelompokkan berdasarkan kategori: SEO, Media, Content, Layout, Settings, Other
- Dapat di-embed ke content type via field tipe `component`
- Memiliki field builder sendiri

### 7.4 Media Library

Sistem pengelolaan media per tenant:

- Upload file (disimpan sebagai base64 data URL di database)
- Metadata: dimensi, alt text, caption, MIME type
- Folder hierarchy per tenant
- Dialog media picker terintegrasi di content editor
- 3 mode input: Library (existing), Upload (baru), URL (eksternal)

### 7.5 Webhook System

Event-driven notification system:

- **Event types**: `content.created`, `content.updated`, `content.deleted`, `content.published`, `media.uploaded`, `media.deleted`
- **Keamanan**: HMAC-SHA256 signature pada setiap payload
- **Custom headers** support
- **Wildcard matching**: subscribe ke `content.*` untuk semua event konten
- **Logging**: Setiap eksekusi webhook dicatat (success/failure, response, duration)
- **Health tracking**: Counter failure untuk monitoring kesehatan webhook

### 7.6 Billing & Payment (Midtrans)

Integrasi pembayaran lengkap dengan Midtrans:

| Plan | Harga | Fitur |
|------|-------|-------|
| Free | Rp 0 | Dasar |
| Starter | Rp 9.000/bulan | Lebih banyak fitur |
| Pro | Rp 29.000/bulan | Fitur premium |
| Enterprise | Rp 199.000/bulan | Semua fitur |

- **Metode pembayaran**: GoPay, ShopeePay, QRIS, Bank Transfer (BCA, BNI, BRI, Mandiri, Permata), Kartu Kredit
- **Proration**: Perhitungan proporsional saat upgrade plan di tengah periode
- **Invoice generation**: Cron job harian (Vercel Cron) untuk generate invoice otomatis
- **Webhook Midtrans**: Notifikasi real-time status pembayaran (SHA512 signature verification)

### 7.7 RBAC (Role-Based Access Control)

Sistem permission granular:

- **System roles**: `super_admin`, `admin`, `user`
- **Tenant roles**: `owner`, `admin`, `editor`, `viewer`
- **Permission categories**: content, media, users, settings, api
- **Auto-seed**: Permission default otomatis dibuat saat pertama kali diakses
- **Custom roles**: Admin dapat membuat role kustom dan assign permission

### 7.8 GraphQL API

Endpoint GraphQL untuk konsumsi konten:

- Endpoint: `POST /api/public/[tenant]/graphql`
- Autentikasi via API Token
- Query support untuk content types dan single types
- Rate limiting (in-memory)

### 7.9 Content Versioning

Setiap perubahan konten dilacak:

- Nomor versi increment otomatis
- Snapshot lengkap data per versi
- Detail perubahan (changes) dicatat
- Identitas editor (createdBy) tersimpan

### 7.10 Audit Logging

Semua aksi penting tercatat:

- User action tracking (login, CRUD, settings change)
- IP address dan User-Agent tercatat
- Metadata tambahan per event
- Filter berdasarkan tenant, user, aksi

### 7.11 Monitoring & Metrik

Dashboard monitoring untuk Super Admin:

- System metrics: CPU, memory, disk usage
- API request statistics: total request, error rate, response time
- Grafik real-time
- Log API request per tenant

### 7.12 Public REST API

Content delivery API untuk frontend consumer:

- Token-based authentication (Bearer)
- Hanya konten `published` yang dikembalikan
- Pagination support
- Filtering dan sorting
- Separated endpoints untuk content types dan single types

---

## 8. Analisis Keamanan

### 8.1 Kontrol Keamanan yang Sudah Ada ✅

| Aspek | Status | Detail |
|-------|--------|--------|
| **SQL Injection** | ✅ Aman | Prisma ORM — tidak ada raw query |
| **Password Hashing** | ✅ Baik | Bcrypt 12 salt rounds + legacy migration |
| **Authentication** | ✅ Ada | NextAuth.js + JWT + OAuth |
| **Authorization** | ✅ Ada | Role-based + tenant membership check |
| **Super Admin Bypass** | ✅ Fixed | `getTenantAccess()` helper untuk akses lintas tenant |
| **Audit Trail** | ✅ Ada | IP, User-Agent, metadata tercatat |
| **Stack Trace** | ✅ Aman | Error generic ke client, detail di server log |
| **Webhook Signature** | ✅ Ada | HMAC-SHA256 |
| **Payment Signature** | ✅ Ada | SHA512 verifikasi Midtrans |
| **API Token** | ✅ Ada | Prefix `cf_`, expiration support |
| **Multi-tenant Isolation** | ✅ Ada | Data di-filter berdasarkan tenantId |

### 8.2 Kerentanan yang Ditemukan 🔴

#### KRITIKAL

| # | Masalah | Risiko | Detail |
|---|---------|--------|--------|
| 1 | **File `.env` terexpose** | 🔴 Kritikal | Password database, JWT secret, API key Midtrans tersimpan di repository. Perlu segera di-rotate dan tambahkan .env ke .gitignore |
| 2 | **File upload tanpa batasan** | 🔴 Kritikal | Tidak ada limit ukuran file, tidak ada validasi MIME type, tidak ada magic byte check. Media disimpan sebagai base64 di database → DoS dan DB bloat |
| 3 | **Input validation tidak ada** | 🔴 Kritikal | Zod v4.3.5 terpasang tapi **tidak digunakan**. Semua API menerima JSON tanpa validasi. Rentan terhadap data invalid dan serangan injection |
| 4 | **Tidak ada CSRF protection** | 🔴 Kritikal | Tidak ada CSRF token di form maupun API. POST/DELETE bisa di-trigger dari domain lain |

#### TINGGI

| # | Masalah | Risiko | Detail |
|---|---------|--------|--------|
| 5 | **Rate limiting parsial** | 🟠 Tinggi | Hanya diterapkan di GraphQL endpoint. Login, register, checkout, dan semua admin API tidak dilindungi. Storage in-memory (tidak cocok multi-server) |
| 6 | **XSS tidak dicegah** | 🟠 Tinggi | Tidak ada DOMPurify atau sanitasi HTML. Rich text editor menerima HTML mentah tanpa filter |
| 7 | **Debug logging di production** | 🟠 Tinggi | `console.log("=== DEBUGGING START ===")` masih ada di content-types route |

#### SEDANG

| # | Masalah | Risiko | Detail |
|---|---------|--------|--------|
| 8 | **Zero test coverage** | 🟡 Sedang | Tidak ada file test (`.test.ts`, `.spec.ts`), jest/vitest config tidak ditemukan |
| 9 | **Tidak ada CI/CD** | 🟡 Sedang | Tidak ada GitHub Actions, Dockerfile, atau pipeline otomatis |
| 10 | **Security headers tidak ada** | 🟡 Sedang | Tidak ada CSP, X-Frame-Options, HSTS, X-Content-Type-Options |

### 8.3 Skor Keamanan

| Aspek | Skor (1-10) |
|-------|-------------|
| Autentikasi | 7/10 |
| Autorisasi | 7/10 |
| Input Validation | 2/10 |
| Data Protection | 4/10 |
| Upload Security | 1/10 |
| Rate Limiting | 3/10 |
| XSS Prevention | 2/10 |
| CSRF Protection | 1/10 |
| Monitoring & Logging | 7/10 |
| **Rata-rata** | **3.8/10** |

---

## 9. Analisis SWOT

### 9.1 Strengths (Kekuatan)

| # | Kekuatan | Detail |
|---|----------|--------|
| 1 | **Arsitektur multi-tenant yang solid** | Isolasi data berbasis tenantId, junction table untuk assignment, role-based per tenant |
| 2 | **Tech stack modern** | Next.js 16, React 19, Prisma 6, TypeScript 5 — cutting edge |
| 3 | **Content model fleksibel** | 23 tipe field, 3 jenis schema (content type, single type, component), field builder interaktif |
| 4 | **Payment integration siap pakai** | Midtrans terintegrasi penuh — checkout, webhook, invoice, proration |
| 5 | **Dual API delivery** | REST dan GraphQL untuk content delivery public |
| 6 | **Content versioning** | Setiap perubahan tercatat dengan detail |
| 7 | **Webhook event system** | HMAC-SHA256, wildcard matching, logging lengkap |
| 8 | **Audit trail komprehensif** | IP, User-Agent, metadata per aksi |
| 9 | **UI/UX matang** | shadcn/ui + Radix UI + dark mode + responsive |
| 10 | **Deployment fleksibel** | Standalone output, Vercel-compatible, Caddy reverse proxy |

### 9.2 Weaknesses (Kelemahan)

| # | Kelemahan | Impact |
|---|-----------|--------|
| 1 | **Zero test coverage** | Tidak ada jaminan regresi. Perubahan kode bisa merusak fitur tanpa terdeteksi |
| 2 | **Input validation tidak ada** | API menerima data arbitrary → crash, data corrupt, security breach |
| 3 | **Media disimpan sebagai base64 di DB** | Ukuran database membengkak, performa turun drastis seiring media bertambah |
| 4 | **Tidak ada CI/CD pipeline** | Deployment manual, tidak ada automated testing/building |
| 5 | **Secret management buruk** | `.env` di repository → credential leak |
| 6 | **Rate limiting hanya in-memory** | Reset saat restart, tidak berfungsi di multi-instance |
| 7 | **Duplikasi kode di API routes** | Pattern auth+membership check berulang di 62+ routes (sudah diperbaiki sebagian dengan getTenantAccess) |
| 8 | **Tidak ada error monitoring** | Tidak ada Sentry atau error tracking service |
| 9 | **Zod terpasang tapi tidak digunakan** | Dependency percuma, missed opportunity untuk validasi |
| 10 | **3 editor terpasang** | React Quill, CKEditor 5, dan MDX Editor sekaligus → bundle size besar |

### 9.3 Opportunities (Peluang)

| # | Peluang | Potensi |
|---|---------|---------|
| 1 | **Marketplace template content type** | Tenant bisa memilih dari library template siap pakai |
| 2 | **AI content generation** | Integrasi OpenAI/Gemini untuk auto-generate konten dari field schema |
| 3 | **Localization (i18n) konten** | next-intl sudah terpasang, bisa dikembangkan untuk multi-language content |
| 4 | **Plugin system** | Arsitektur component sudah mendukung — bisa diperluas ke plugin ecosystem |
| 5 | **White-label** | Tenant dengan plan Enterprise bisa custom branding |
| 6 | **Pasar Indonesia** | Midtrans integration sudah ready — advantage untuk pasar lokal |
| 7 | **Real-time collaboration** | Socket.IO sudah ada contoh — bisa dikembangkan untuk live editing |
| 8 | **CDN/Asset service** | Migrasi dari base64-in-DB ke object storage (S3/R2) + CDN |
| 9 | **Mobile SDK** | Public API sudah ada — bisa buat SDK React Native/Flutter |
| 10 | **Workflow & approval** | Status system sudah ada — bisa ditambah approval chain |

### 9.4 Threats (Ancaman)

| # | Ancaman | Risiko |
|---|---------|--------|
| 1 | **Security breach** | Kerentanan kritikal yang tidak ditangani bisa menyebabkan data leak |
| 2 | **Database scaling** | Base64 media + single PostgreSQL → bottleneck saat data membesar |
| 3 | **Kompetitor** | Strapi, Payload CMS, Sanity, Contentful — ekosistem lebih matang |
| 4 | **Dependency vulnerability** | 40+ dependencies tanpa automated security scanning |
| 5 | **Vendor lock-in Midtrans** | Satu-satunya payment provider — perlu abstraksi payment gateway |
| 6 | **Downtime tanpa monitoring** | Tidak ada alerting otomatis (hanya dashboard metrik) |
| 7 | **Data loss** | Tidak ada backup strategy yang terdokumentasi |
| 8 | **Compliance (GDPR/PDP)** | Data personal user tersimpan tanpa mekanisme deletion request |

---

## 10. Rekomendasi

### 10.1 Prioritas Kritikal (Minggu 1-2)

| # | Aksi | Effort | Impact |
|---|------|--------|--------|
| 1 | **Rotate semua secrets** — pindahkan `.env` ke `.gitignore`, ganti semua password/key/secret | 1 hari | 🔴 Kritikal |
| 2 | **Implementasi Zod validation** di semua API route — minimal: register, login, CRUD content, checkout | 3-4 hari | 🔴 Kritikal |
| 3 | **Migrasi media ke Object Storage** — gunakan S3/Cloudflare R2 + signed URL, hapus base64 dari DB | 2-3 hari | 🔴 Kritikal |
| 4 | **File upload validation** — limit size (10MB), whitelist MIME type, magic byte check | 1 hari | 🔴 Kritikal |
| 5 | **Tambahkan CSRF protection** — CSRF token di semua state-changing form/API | 1-2 hari | 🔴 Kritikal |
| 6 | **Hapus debug logging** — bersihkan semua `console.log("=== DEBUGGING")` | 30 menit | 🟠 Tinggi |

### 10.2 Prioritas Tinggi (Minggu 2-4)

| # | Aksi | Effort | Impact |
|---|------|--------|--------|
| 7 | **Rate limiting Redis-based** — terapkan di semua endpoint, gunakan Redis bukan in-memory | 2 hari | 🟠 Tinggi |
| 8 | **XSS sanitization** — DOMPurify untuk semua rich text content | 1 hari | 🟠 Tinggi |
| 9 | **Security headers** — CSP, X-Frame-Options, HSTS, X-Content-Type-Options via middleware | 1 hari | 🟠 Tinggi |
| 10 | **Unit & integration tests** — mulai dari API routes kritis (auth, content CRUD, payment) | 5-7 hari | 🟡 Sedang |
| 11 | **CI/CD pipeline** — GitHub Actions: lint → test → build → deploy | 1-2 hari | 🟡 Sedang |
| 12 | **Error monitoring** — integrasikan Sentry atau Axiom | 1 hari | 🟡 Sedang |

### 10.3 Prioritas Sedang (Bulan 2)

| # | Aksi | Effort | Impact |
|---|------|--------|--------|
| 13 | **Konsolidasi editor** — pilih satu (React Quill ATAU CKEditor), hapus sisanya untuk bundle size | 1 hari | 🟡 |
| 14 | **Dockerize aplikasi** — Dockerfile + docker-compose (app + PostgreSQL + Redis) | 1-2 hari | 🟡 |
| 15 | **Database backup strategy** — pg_dump otomatis, point-in-time recovery | 1 hari | 🟡 |
| 16 | **API versioning** — prefix `/api/v1/` untuk backward compatibility | 2-3 hari | 🟡 |
| 17 | **API documentation** — OpenAPI/Swagger auto-generated | 2-3 hari | 🟡 |
| 18 | **Payment gateway abstraction** — abstract Midtrans agar mudah tambah provider lain | 2-3 hari | 🟡 |

### 10.4 Prioritas Rendah (Bulan 3+)

| # | Aksi | Effort |
|---|------|--------|
| 19 | **i18n content** — multi-language content management per tenant |
| 20 | **Content workflow** — approval chains, scheduled publishing |
| 21 | **Real-time collaboration** — live editing dengan WebSocket |
| 22 | **Plugin marketplace** — ekosistem plugin untuk content types |
| 23 | **Mobile SDK** — React Native / Flutter SDK untuk public API |
| 24 | **GDPR/PDP compliance** — data deletion request, privacy tools |
| 25 | **White-label** — custom domain + branding per tenant |

---

## 11. Statistik Proyek

### 11.1 Codebase

| Metrik | Nilai |
|--------|-------|
| Total file TypeScript/TSX | ~230 |
| Estimasi Lines of Code | ~100.000+ |
| UI Components (shadcn/ui) | ~50 file |
| API Routes | ~62 route (93+ HTTP methods) |
| Dashboard Pages | ~50+ halaman |
| Migration Scripts | ~15 file |
| Core Library Files | ~11 file |
| Prisma Models | 21+ |
| Database Migrations | 2 |

### 11.2 Dependencies

| Kategori | Jumlah |
|----------|--------|
| Production dependencies | ~40+ |
| Dev dependencies | ~10+ |
| UI library components | ~30+ |
| Total npm packages | ~50+ |

### 11.3 Fitur

| Metrik | Nilai |
|--------|-------|
| Field types supported | 23 |
| User roles (system) | 3 (super_admin, admin, user) |
| Tenant roles | 4 (owner, admin, editor, viewer) |
| Payment methods | 6+ (GoPay, ShopeePay, QRIS, Bank Transfer, Kartu Kredit) |
| Subscription plans | 4 (Free, Starter, Pro, Enterprise) |
| Webhook event types | 6+ |
| API authentication methods | 2 (JWT session, API Token) |
| OAuth providers | 2 (Google, GitHub) |
| Content delivery APIs | 2 (REST, GraphQL) |

### 11.4 Test & Quality

| Metrik | Nilai |
|--------|-------|
| Test coverage | 0% |
| Test files | 0 |
| CI/CD pipeline | Tidak ada |
| Docker support | Tidak ada |
| Error monitoring | Tidak ada |
| Automated security scanning | Tidak ada |

---

## Kesimpulan

**ContentFlow (SACMS)** adalah platform Headless CMS multi-tenant yang secara fungsional sudah **cukup lengkap** — content management, billing, RBAC, webhook, public API (REST + GraphQL), audit logging, dan monitoring sudah ter-implementasi. Arsitekturnya solid dengan pemisahan yang jelas antara admin global, tenant workspace, dan public API consumer.

Namun, sistem ini **belum siap production** karena beberapa kerentanan keamanan kritikal (file upload tanpa batas, input validation tidak ada, CSRF tidak ada, secrets terexpose) dan tidak adanya test coverage maupun CI/CD pipeline. Media storage menggunakan base64 di database juga menjadi bottleneck performa yang harus segera diatasi.

**Prioritas utama** sebelum go-live:

1. 🔴 Rotate secrets + amankan `.env`
2. 🔴 Implementasi input validation (Zod) di semua API
3. 🔴 Migrasi media ke Object Storage (S3/R2)
4. 🔴 File upload security (size limit, type validation)
5. 🔴 CSRF protection
6. 🟠 Rate limiting (Redis) di semua endpoint
7. 🟠 XSS sanitization
8. 🟡 Test coverage minimal 50%
9. 🟡 CI/CD pipeline

Dengan penanganan prioritas kritikal dan tinggi (estimasi 2-4 minggu), sistem ini akan siap untuk **soft launch** dengan monitoring ketat.

---

*Dokumen ini di-generate berdasarkan analisis codebase pada 15 Maret 2026.*
