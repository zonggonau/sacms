# Implementation Traceability & Documentation Baseline

**Audit Method:** Codebase inspection, full TypeScript compile check (`tsc --noEmit`), and Vitest test suite execution.  
**Baseline Date:** 23 Agustus 2026  
**Repository Package Version:** `1.2.1` (`v1.2.1.0`)  
**Test Suite Status:** 18 Test Suites / 112 Unit Tests Passing (100% PASS) | TypeScript 0 Compile Errors | Browser QA Health 99/100.

---

## 1. Tujuan Dokumen

Dokumen ini adalah acuan integritas implementasi SaCMS untuk memastikan seluruh spesifikasi bisnis, manual pengguna, kontrak API, dan dokumentasi teknis selaras 100% dengan kode sumber aktif di direktori `src/`, `prisma/`, dan `mini-services/`.

---

## 2. Hierarki Sumber Kebenaran (Source of Truth)

1. `prisma/schema.prisma` untuk model basis data, relasi, indeks, dan enum.
2. `src/lib/content-workflow.ts` untuk state machine workflow konten dan hak akses transisi role.
3. `src/app/api/**/route.ts` untuk kontrak rute HTTP, autentikasi, validasi Zod v4, dan respons.
4. `src/actions/*.ts` untuk Server Actions mutasi data internal dashboard.
5. `src/lib/*.ts` untuk business logic reusable (database router, rate limiter, cache, license, R2, AI).
6. `src/app/**/page.tsx` untuk halaman antarmuka pengguna dashboard dan publik.
7. `docs/04-openapi.yaml` untuk spesifikasi kontrak OpenAPI publik.
8. Seluruh dokumen naratif di direktori `docs/`.

---

## 3. Matriks Kemampuan Produk (Product Capability Matrix)

| Kapabilitas / Fitur | Status | Modul Implementasi Utama | Batasan & Karakteristik Aktif |
|---|---|---|---|
| **Credentials Authentication** | Implemented | `src/lib/auth.ts`, NextAuth v4 | Email wajib terverifikasi; password di-hash dengan bcrypt |
| **Google/GitHub OAuth** | Implemented with constraint | `src/lib/auth.ts` | Tombol OAuth aktif otomatis jika env var penyedia tersedia |
| **Multi-Tenant Membership** | Implemented | `Tenant`, `TenantMember`, `getTenantAccess()` | Super Admin memiliki konteks akses setara owner pada semua tenant |
| **Enterprise Dedicated DB** | Implemented | `src/lib/database.ts:getTenantDb` | Dedicated client dengan LRU pool 10 menit + failover guard ke Master DB |
| **Collection Type Modeling** | Implemented | `ContentType`, `SchemaField`, actions | Mendukung schema tenant-owned dan schema assignment global |
| **Single Type Modeling** | Implemented | `SingleType`, `TenantSingleTypeAssignment` | Mendukung konten tunggal dengan tab isolasi per-locale |
| **Reusable Components** | Implemented | `Component`, `SchemaField`, component UI | Dilengkapi impact analysis (peringatan sebelum komponen dihapus) |
| **Content State Machine** | Implemented | `content-workflow.ts`, `actions/content.ts` | 7 status (`DRAFT`, `IN_REVIEW`, `APPROVED`, `SCHEDULED`, `PUBLISHED`, `ARCHIVED`, `REJECTED`) |
| **Sequential Review System** | Implemented | `ContentReviewAssignment`, reviewer routes | Reviewer wajib anggota tenant yang sama dengan peran non-viewer |
| **Scheduled Auto-Publish** | Implemented | `/api/cron/publish` | Berjalan via cron dengan secret token; mengubah SCHEDULED → PUBLISHED |
| **Version History Snapshots** | Implemented | `ContentVersion`, `actions/content.ts` | Snapshot otomatis dibuat saat entri dibuat, diupdate, atau dipublish |
| **Localization (i18n)** | Implemented | `TenantLocale`, `documentId`, locale switcher | Field non-localizable disinkronkan otomatis lintas locale |
| **Cloudflare R2 Media Storage** | Implemented | `src/lib/r2.ts`, `/api/tenant/[tenant]/media` | Path terisolasi `${tenantId}/media/...`; otomatis generate thumbnail 150px |
| **Public REST API** | Implemented | `/api/public/[tenant]/content/[contentType]` | Strapi-style filters, population, FTS, sorting, pagination |
| **Public GraphQL API** | Implemented | `/api/public/[tenant]/graphql` | Query dengan Deep Recursive Resolution & mutations untuk token full-access |
| **Model Context Protocol (MCP)** | Implemented | `/api/mcp/[[...transport]]`, `actions/mcp-tokens.ts` | Protokol SSE/HTTP untuk asisten coding AI (Cursor, Windsurf, Claude Code) |
| **AI Schema Engine & Blueprints** | Implemented | `src/lib/ai/schema-engine.ts`, `domain-knowledge.ts` | Blueprint industri instan (Hotel, E-Commerce, News, Agency) |
| **Next.js 16 Starter Exporter** | Implemented | `/api/tenant/[tenant]/ai-builder/export-starter` | Menghasilkan bundel ZIP Next.js 16 + TailwindCSS v4 + SaCMS SDK |
| **Enterprise Licensing (RSA)** | Implemented | `src/lib/license.ts`, `/admin/enterprise/licenses` | Verifikasi offline via RSA Public Key & online database license caching |
| **API Token Hashing** | Implemented | `src/actions/api-keys.ts`, `ApiToken` | Plaintext token dikembalikan sekali; database hanya menyimpan SHA-256 |
| **Rate Limiting (Edge)** | Implemented | `src/lib/rate-limit.ts`, `proxy.ts` | Pipeline Upstash Redis (`cf:rl:*`) dengan in-memory fallback |
| **Webhooks (Sync & Async)** | Implemented | `src/lib/webhooks.ts`, `/api/cron/webhook-retry` | Before-hooks blocking + async delivery dengan HMAC SHA-256 & DLQ retry |
| **Audit Trail Logging** | Implemented | `src/lib/audit-log.ts`, `AuditLog` | Mencatat seluruh aksi mutasi konten, skema, role, dan billing |
| **Midtrans Subscription Billing**| Implemented | `src/lib/midtrans.ts`, `/api/billing/` | Alur pembayaran Snap, status callback webhook, dan auto-upgrade tier |
| **White-Label & Custom Domain** | Implemented | `src/proxy.ts`, `/api/tenant/[tenant]/white-label` | Pendaftaran custom domain, verifikasi DNS TXT, dan proxy Edge caching |
| **TypeScript SDK** | Implemented | `mini-services/sdk` | Client typed untuk integrasi frontend Next.js / React / Node.js |

---

## 4. Status Verifikasi Codebase Terakhir

- **TypeScript Compiler (`tsc --noEmit`):** 🟢 **0 Compile Errors (Clean)**
- **Unit Test Suite (`vitest run`):** 🟢 **18/18 Files PASS (112 Tests)**
- **Headless Browser QA (`gstack browse`):** 🟢 **Health Score 99/100**
- **Git Branch Remote:** 🟢 **Branch `aisacms` tersinkronisasi ke remote GitHub**
