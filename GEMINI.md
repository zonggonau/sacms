# SaCMS — AI Assistant Context

## Apa ini?
**SaCMS** adalah SaaS Headless CMS multi-tenant berbasis Next.js 16 (App Router). Ini adalah alternatif Strapi dengan built-in billing (Midtrans), multi-tenancy native, dan AI-powered content generation.

## Tech Stack
- **Framework:** Next.js 16 (App Router, Server Components)
- **Database:** PostgreSQL via Prisma ORM (output: `prisma/generated-client/`)
- **Auth:** NextAuth v4 dengan Prisma adapter
- **Storage:** Cloudflare R2 (S3-compatible) via `@aws-sdk/client-s3`
- **Cache/Rate-limit:** Upstash Redis (`@upstash/redis`) — Edge compatible
- **Payments:** Midtrans (`midtrans-client`)
- **UI:** TailwindCSS v4 + Radix UI + shadcn/ui (`components/ui/`)
- **Testing:** Vitest (unit) + Playwright (E2E, folder `e2e/`)
- **Monitoring:** Sentry (`@sentry/nextjs`)
- **GraphQL:** Dynamic schema builder di `lib/graphql-schema.ts`

## Struktur Direktori Penting
```
src/
  app/
    api/
      public/[tenant]/content/[contentType]/route.ts  ← Public REST API (filtering, search, populate)
      public/[tenant]/graphql/                         ← Public GraphQL API
      public/[tenant]/single/                          ← Single types API
      tenant/[tenant]/content/                         ← Tenant management API
      tenant/[tenant]/media/                           ← Media upload API (R2)
      tenant/[tenant]/webhooks/                        ← Webhook CRUD
      cron/publish/                                    ← Scheduled publish cron
      cron/webhook-retry/                              ← DLQ retry cron
      admin/                                           ← Super admin panel
    cms/[tenant]/                                      ← Tenant dashboard UI
  lib/
    filters.ts          ← Advanced filtering engine (Strapi-style operators)
    content-workflow.ts ← Content status state machine
    graphql-schema.ts   ← Dynamic GraphQL schema builder
    webhooks.ts         ← Async webhooks + sync hooks + DLQ
    r2.ts               ← Cloudflare R2 upload + thumbnails
    redis.ts            ← Upstash Redis singleton
    rate-limit.ts       ← Redis rate limiting + in-memory fallback
    midtrans.ts         ← Payment gateway
    audit-log.ts        ← Audit logging
    rbac.ts             ← Role-based access control
    tenant-plan.ts      ← Plan limits enforcement
    database.ts         ← Prisma client singleton + enterprise DB routing
  proxy.ts              ← Security headers, rate limiting, CORS, custom domain routing
prisma/
  schema.prisma         ← Main schema (709 lines)
  migrations/           ← SQL migration history
mini-services/
  sdk/                  ← @sacms/sdk TypeScript client (WIP)
__tests__/              ← Vitest unit tests
e2e/                    ← Playwright E2E tests (core CMS, auth flows)
```

## Naming Conventions
- **API routes:** Next.js App Router file conventions (`route.ts` inside `[param]` folders)
- **Tenant slug vs ID:** Most APIs accept both — slug for public routes, ID internally
- **Content entries:** JSON data stored in `data` column (JSONB). Access fields as `data->>\'fieldSlug\'` in raw SQL
- **Status enum:** `DRAFT | IN_REVIEW | APPROVED | SCHEDULED | PUBLISHED | ARCHIVED | REJECTED`

## Penting: Pattern yang Digunakan

### Multi-tenant DB routing
```ts
// lib/database.ts
const tenantDb = await getTenantDb(tenantId)  // Shared pool or dedicated DB for Enterprise
```

### Content Filtering (Public API)
Gunakan `parseFilters()` + `buildFilterSQL()` dari `lib/filters.ts`. Semua filter values di-parameterize (SQL injection safe).

### Webhook triggering (async)
```ts
triggerWebhooks(tenantId, WebhookEvents.CONTENT_CREATED, { entry })
```

### Sync hooks (before save)
```ts
const hookResult = await executeSyncHooks(tenantId, WebhookEvents.BEFORE_CREATE, data)
if (!hookResult.allowed) throw new Error(hookResult.rejectMessage)
const finalData = hookResult.modifiedData ?? data
```

### Content Workflow transitions
```ts
import { canRoleTransition } from "@/lib/content-workflow"
if (!canRoleTransition(current.status, "PUBLISHED", userRole)) {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 })
}
```

## Environment Variables Penting
| Variable | Kegunaan |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection URL |
| `NEXTAUTH_SECRET` | NextAuth session secret |
| `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` | Redis untuk rate limiting & cache |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL` | Cloudflare R2 storage |
| `MIDTRANS_SERVER_KEY`, `MIDTRANS_CLIENT_KEY` | Payment gateway |
| `CRON_SECRET` | Secret untuk mengamankan cron endpoints |
| `OPENAI_API_KEY` | AI content generation (optional) |

## DO & DON'T

### DO
- Selalu gunakan Zod untuk validasi input di API routes
- Gunakan `tenantDb` (dari `getTenantDb`) bukan `db` langsung untuk data content
- Rate limit semua endpoint publik menggunakan `rateLimit()` dari `lib/rate-limit.ts`
- Tambahkan audit log untuk semua operasi content CRUD
- Handle JSON data field dengan `.data as Record<string, unknown>` — bukan string
# SaCMS — AI Assistant Context

## Apa ini?
**SaCMS** adalah SaaS Headless CMS multi-tenant berbasis Next.js 16 (App Router). Ini adalah alternatif Strapi dengan built-in billing (Midtrans), multi-tenancy native, dan AI-powered content generation.

## Tech Stack
- **Framework:** Next.js 16 (App Router, Server Components)
- **Database:** PostgreSQL via Prisma ORM (output: `prisma/generated-client/`)
- **Auth:** NextAuth v4 dengan Prisma adapter
- **Storage:** Cloudflare R2 (S3-compatible) via `@aws-sdk/client-s3`
- **Cache/Rate-limit:** Upstash Redis (`@upstash/redis`) — Edge compatible
- **Payments:** Midtrans (`midtrans-client`)
- **UI:** TailwindCSS v4 + Radix UI + shadcn/ui (`components/ui/`)
- **Testing:** Vitest (unit) + Playwright (E2E, folder `e2e/`)
- **Monitoring:** Sentry (`@sentry/nextjs`)
- **GraphQL:** Dynamic schema builder di `lib/graphql-schema.ts`

## Struktur Direktori Penting
```
src/
  app/
    api/
      public/[tenant]/content/[contentType]/route.ts  ← Public REST API (filtering, search, populate)
      public/[tenant]/graphql/                         ← Public GraphQL API
      public/[tenant]/single/                          ← Single types API
      tenant/[tenant]/content/                         ← Tenant management API
      tenant/[tenant]/media/                           ← Media upload API (R2)
      tenant/[tenant]/webhooks/                        ← Webhook CRUD
      cron/publish/                                    ← Scheduled publish cron
      cron/webhook-retry/                              ← DLQ retry cron
      admin/                                           ← Super admin panel
    cms/[tenant]/                                      ← Tenant dashboard UI
  lib/
    filters.ts          ← Advanced filtering engine (Strapi-style operators)
    content-workflow.ts ← Content status state machine
    graphql-schema.ts   ← Dynamic GraphQL schema builder
    webhooks.ts         ← Async webhooks + sync hooks + DLQ
    r2.ts               ← Cloudflare R2 upload + thumbnails
    redis.ts            ← Upstash Redis singleton
    rate-limit.ts       ← Redis rate limiting + in-memory fallback
    midtrans.ts         ← Payment gateway
    audit-log.ts        ← Audit logging
    rbac.ts             ← Role-based access control
    tenant-plan.ts      ← Plan limits enforcement
    database.ts         ← Prisma client singleton + enterprise DB routing
  proxy.ts              ← Security headers, rate limiting, CORS, custom domain routing
prisma/
  schema.prisma         ← Main schema (709 lines)
  migrations/           ← SQL migration history
mini-services/
  sdk/                  ← @sacms/sdk TypeScript client (WIP)
__tests__/              ← Vitest unit tests
e2e/                    ← Playwright E2E tests (core CMS, auth flows)
```

## Naming Conventions
- **API routes:** Next.js App Router file conventions (`route.ts` inside `[param]` folders)
- **Tenant slug vs ID:** Most APIs accept both — slug for public routes, ID internally
- **Content entries:** JSON data stored in `data` column (JSONB). Access fields as `data->>\'fieldSlug\'` in raw SQL
- **Status enum:** `DRAFT | IN_REVIEW | APPROVED | SCHEDULED | PUBLISHED | ARCHIVED | REJECTED`

## Penting: Pattern yang Digunakan

### Multi-tenant DB routing
```ts
// lib/database.ts
const tenantDb = await getTenantDb(tenantId)  // Shared pool or dedicated DB for Enterprise
```

### Content Filtering (Public API)
Gunakan `parseFilters()` + `buildFilterSQL()` dari `lib/filters.ts`. Semua filter values di-parameterize (SQL injection safe).

### Webhook triggering (async)
```ts
triggerWebhooks(tenantId, WebhookEvents.CONTENT_CREATED, { entry })
```

### Sync hooks (before save)
```ts
const hookResult = await executeSyncHooks(tenantId, WebhookEvents.BEFORE_CREATE, data)
if (!hookResult.allowed) throw new Error(hookResult.rejectMessage)
const finalData = hookResult.modifiedData ?? data
```

### Content Workflow transitions
```ts
import { canRoleTransition } from "@/lib/content-workflow"
if (!canRoleTransition(current.status, "PUBLISHED", userRole)) {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 })
}
```

## Environment Variables Penting
| Variable | Kegunaan |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection URL |
| `NEXTAUTH_SECRET` | NextAuth session secret |
| `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` | Redis untuk rate limiting & cache |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL` | Cloudflare R2 storage |
| `MIDTRANS_SERVER_KEY`, `MIDTRANS_CLIENT_KEY` | Payment gateway |
| `CRON_SECRET` | Secret untuk mengamankan cron endpoints |
| `OPENAI_API_KEY` | AI content generation (optional) |

## DO & DON'T

### DO
- Selalu gunakan Zod untuk validasi input di API routes
- Gunakan `tenantDb` (dari `getTenantDb`) bukan `db` langsung untuk data content
- Rate limit semua endpoint publik menggunakan `rateLimit()` dari `lib/rate-limit.ts`
- Tambahkan audit log untuk semua operasi content CRUD
- Handle JSON data field dengan `.data as Record<string, unknown>` — bukan string

### DON'T
- Jangan gunakan `JSON.parse()` pada field yang bertipe `Json` di Prisma — sudah otomatis di-deserialize
- Jangan import `ioredis` — proyek hanya menggunakan `@upstash/redis`
- Jangan hardcode locale `"en"` — selalu lookup default locale dari `TenantLocale`
- Jangan buat raw SQL query tanpa parameterized values
- Jangan lewatkan `tenantId` check pada semua query — ini critical untuk data isolation

## Fitur Unggulan Next.js yang Diterapkan
SaCMS secara ekstensif memanfaatkan fitur-fitur mutakhir dari Next.js 16 (App Router) untuk performa dan DX yang optimal:
- **Server Components & Server Actions:** *Fetch* dan *mutate* data langsung di *server* (tanpa API *layer* tambahan untuk *internal dashboard*) untuk menghindari *waterfall requests* dan mempercepat interaksi.
- **Route Handlers & Middleware:** Membangun *Public* REST/GraphQL API dengan pengamanan otentikasi, *rate-limiting* terintegrasi Edge (Upstash Redis), dan *custom domain routing* di tingkat *Middleware*.
- **Dynamic HTML Streaming:** *Render* UI secara asinkron menggunakan React Suspense, memberikan pengalaman *dashboard* yang instan tanpa *blocking*.
- **Advanced Routing & Route Groups:** Memanfaatkan *route groups* Next.js secara ekstensif (`(public)`, `(content)`, `(system)`, `(workspace)`, `(billing)`) untuk isolasi logika antar domain fitur.
- **Data Fetching & Client/Server Rendering (ISR):** Kombinasi fleksibel antara *Server Fetching*, *Client Fetching*, dan dukungan *caching* (ISR) untuk menyajikan API super cepat.
- **Built-in Optimizations & CSS:** Pemanfaatan optimasi gambar/font bawaan serta *styling* menggunakan integrasi murni Tailwind CSS v4 + UI komponen berbasis Radix.

## Fase Pengembangan (PRD)
- **Phase 1 (selesai):** Content workflow, R2 media, filtering, security
- **Phase 2 (selesai):** i18n, GraphQL mutations, FTS, SDK (WIP), scheduled publish, sync hooks
- **Phase 3 (selesai):** Tests ≥50%, CI/CD, API docs, Docker, performance
