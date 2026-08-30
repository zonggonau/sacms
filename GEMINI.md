# SaCMS — AI Assistant Context & Developer Guidelines

## 🌟 Apa ini?
**SaCMS** adalah SaaS Headless CMS multi-tenant modern berbasis Next.js 16 (App Router). Ini adalah alternatif Strapi enterprise-grade dengan built-in billing (Midtrans), multi-tenancy native (Shared Pool & Dedicated PostgreSQL Appliance), custom domain DNS management ala Vercel, white-label branding, dan AI-powered content generation.

---

## 🛠️ Tech Stack
- **Framework:** Next.js 16 (App Router, Server Components & Server Actions)
- **Package Manager & Runtime:** Bun (`bun run dev`, `bun run build`, `bun run start`, `bun test`, `bunx prisma ...`)
- **Database & ORM:** PostgreSQL 17 via Prisma ORM (client generator output: `prisma/generated-client/`)
- **Auth:** NextAuth v4 dengan Prisma adapter + RBAC + 2FA support
- **Storage:** Cloudflare R2 / AWS S3 / MinIO via `@aws-sdk/client-s3`
- **Cache & Rate-limit:** Upstash Redis (`@upstash/redis`) — Edge & Serverless compatible
- **Payments:** Midtrans Snap (`midtrans-client`)
- **UI & Design:** TailwindCSS v4 + Radix UI + shadcn/ui (`components/ui/`) + Lucide Icons
- **Testing:** Vitest (unit/integration) + Playwright (E2E)
- **Monitoring:** Sentry (`@sentry/nextjs`)
- **GraphQL:** Dynamic GraphQL schema builder & executor di `src/lib/graphql-schema.ts`
- **MCP Bridge:** Model Context Protocol SDK (`@modelcontextprotocol/sdk`)

---

## 📁 Struktur Direktori Penting
```
src/
  app/
    (workspace)/
      dashboard/
        [tenant]/
          (dashboard)/
            page.tsx                     ← Workspace Hub & Overview Dashboard
            content-types/               ← Content Types management
            content-type-builder/        ← Visual Schema Drag & Drop Builder
            domains/                     ← Custom Domains & Vercel DNS Diagnostics
            infrastructure/              ← Dedicated PostgreSQL & MinIO Appliance
            subscriptions/               ← Billing, Plans & Add-on Credits
            users/                       ← Team Members & RBAC Roles
            system/audit/                ← System Audit Logging
            settings/                    ← Workspace Settings (General, Branding, SMTP, Security, Danger Zone)
          (cms)/
            cms/content/[contentType]/   ← Content Manager table & rich entry editors
          developer/
            page.tsx                     ← Developer Overview & API Tokens
            api-keys/                    ← API Key Management & Rate Limit Config
            webhooks/                    ← Webhook CRUD & Real-time Logs
            mcp/                         ← Model Context Protocol AI Integration
            docs/                        ← Interactive Swagger API Docs
            graphql/                     ← GraphQL Playground
    api/
      public/[tenant]/content/[type]/    ← Public REST API (Filtering, Search, Populate, i18n)
      public/[tenant]/graphql/           ← Public Dynamic GraphQL API
      public/[tenant]/brand/             ← Public White-Label Brand Info
      tenant/[tenant]/content/           ← Tenant Content Management & Purge
      tenant/[tenant]/media/             ← Media Upload (R2/MinIO)
      tenant/[tenant]/domains/           ← Custom Domain CRUD, DNS Verify, Search & Checkout
      tenant/[tenant]/email/test/        ← Live SMTP Connection & Test Email
      tenant/[tenant]/white-label/       ← White-Label Branding Configuration
      cron/publish/                      ← Scheduled Content Publish Cron
      cron/webhook-retry/                ← Webhook Dead Letter Queue (DLQ) Retry Cron
      admin/                             ← Super Admin Panel (Tenants, Licenses, System Metrics)
  lib/
    domain-dns.ts        ← Server-side DNS resolver (A Record @ & Subdomain CNAME)
    domain-parser.ts     ← Client-safe domain metadata parser & expected records
    filters.ts           ← Advanced Strapi-style filtering engine (SQL Injection safe)
    content-workflow.ts  ← Content status state machine & role-based transitions
    enterprise-db.ts     ← Hybrid Multi-Tenancy (Isolated Tenant DB Provisioning & Migration)
    database.ts          ← Prisma client singleton + enterprise DB connection pool
    r2.ts                ← Cloudflare R2 / S3 storage upload & thumbnail pipeline
    redis.ts             ← Upstash Redis singleton
    rate-limit.ts        ← Redis rate limiting with in-memory fallback
    midtrans.ts          ← Payment gateway integration
    vercel-registrar.ts  ← Domain availability check, multi-TLD pricing & checkout
    audit-log.ts         ← Security audit logging
    mail.ts              ← Nodemailer SMTP transporter & email templates
  proxy.ts               ← Next.js Edge Proxy: Security headers, CORS, rate limiting, Custom Domain Routing
prisma/
  schema.prisma          ← Master Prisma schema
  migrations/            ← SQL migration history
__tests__/               ← Vitest unit & integration test suites
scripts/                 ← Operational, maintenance, and database migration scripts
```

---

## 🧭 Naming Conventions & Core Rules
- **API routes:** Next.js App Router file conventions (`route.ts` inside `[param]` folders).
- **Tenant slug vs ID:** API routes accept both slug (e.g. `delvia`) and ID (e.g. `cmtcshc...`).
- **Content entries:** Dynamic data stored in `data` column (`JSONB`). Access fields as `data->>'fieldSlug'` in raw SQL.
- **Status enum:** `DRAFT | IN_REVIEW | APPROVED | SCHEDULED | PUBLISHED | ARCHIVED | REJECTED`.

---

## ⚡ Pola Arsitektur Penting

### 1. Multi-Tenant Database Routing (Hybrid Model)
```ts
import { getTenantDb } from "@/lib/database"

// Otomatis mengembalikan dedicated PrismaClient jika databaseUrl terisi (Enterprise/Dedicated)
// atau pool database utama jika menggunakan shared multi-tenancy.
const tenantDb = await getTenantDb(tenantId)
```

### 2. Custom Domain Edge Routing
Edge proxy ([`src/proxy.ts`](file:///d:/projek/z.ai/sacms/src/proxy.ts)) membaca header `host`:
- Jika host adalah domain kustom (misal: `dpr.intanjayakab.go.id`), proxy mencari `domain:${host}` di Redis.
- Permintaan di-*rewrite* otomatis ke `/api/public/${tenantSlug}/...` dengan header `X-Tenant-Domain`.

### 3. Vercel-Style Custom DNS Management
- **Apex / Root Domain (`intanjayakab.go.id`):**
  - `A Record`: Host `@` $\rightarrow$ `161.97.100.1` (IP Gateway Server SaCMS).
  - `TXT Record`: Host `_sacms-challenge` $\rightarrow$ Token Verifikasi.
- **Subdomain (`dpr.intanjayakab.go.id`):**
  - `CNAME Record`: Host `dpr` $\rightarrow$ Target `cname.sacms.cloud`.
  - `TXT Record`: Host `_sacms-challenge.dpr` $\rightarrow$ Token Verifikasi.

---

## 📜 Script Operasional (`package.json`)

| Perintah | Deskripsi |
| :--- | :--- |
| `bun run dev` | Menjalankan server development Next.js |
| `bun run build` | Membuat production build & menyalin standalone assets |
| `bun run test` | Menjalankan seluruh test suite Vitest |
| `bun run db:push` | Mendorong perubahan skema Prisma ke database utama |
| `bun run db:tenant:push` | Mendorong skema ke database dedicated tenant aktif |
| `bun run seed:global` | Menjalankan seeding data global bawaan |
| `bun run seed:permissions` | Melakukan sinkronisasi izin RBAC bawaan |
| `bun run cron:publish` | Mengeksekusi cron scheduled content publishing |
| `bun run qa` | Menjalankan suite QA automation |

---

## 🔑 Environment Variables Penting

| Variable | Kegunaan |
| :--- | :--- |
| `DATABASE_URL` | PostgreSQL connection URL (Database Utama) |
| `DIRECT_URL` | PostgreSQL direct connection URL (Bypass pooler) |
| `NEXTAUTH_SECRET` | Secret key sesi NextAuth |
| `UPSTASH_REDIS_REST_URL` & `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis untuk cache & rate limiting |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL` | Cloudflare R2 Storage |
| `PUBLIC_GATEWAY_IP` | IP Gateway SaCMS untuk DNS A-Record custom domain (default: `161.97.100.1`) |
| `PUBLIC_CNAME_TARGET` | Target CNAME SaCMS untuk subdomain (default: `cname.sacms.cloud`) |
| `MIDTRANS_SERVER_KEY`, `MIDTRANS_CLIENT_KEY` | Payment gateway Midtrans |
| `LICENSE_KEY` | Kunci lisensi RSA Enterprise self-hosted (opsional) |

---

## 🚫 DO & DON'T

### DO
- ✅ Selalu gunakan **Bun** (`bun`, `bunx`, `bun run`, `bun test`) untuk package management dan eksekusi command.
- ✅ Selalu validasi request body menggunakan **Zod** di seluruh API Route.
- ✅ Selalu gunakan `tenantDb = await getTenantDb(tenantSlug)` untuk seluruh query entri konten dan media.
- ✅ Tambahkan audit log (`logAudit`) untuk seluruh aksi mutasi konten, pengaturan, dan keanggotaan tim.
- ✅ Handle JSON data field dengan `.data as Record<string, unknown>`.

### DON'T
- ❌ Jangan pernah gunakan `npm` atau `npx` — selalu gunakan `bun` dan `bunx`.
- ❌ Jangan gunakan `JSON.parse()` pada field bertipe `Json` di Prisma (sudah otomatis ter-deserialize).
- ❌ Jangan impor modul Node.js internal (`dns/promises`, `fs`) ke dalam Client Component (`"use client"`). Pisahkan ke modul helper server.
- ❌ Jangan hardcode locale atau port tanpa fallback yang aman.
