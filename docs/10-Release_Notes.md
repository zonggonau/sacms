# Release Notes & Changelog

Semua perubahan penting (*major*, *minor*, dan *patch*) pada proyek SaCMS didokumentasikan dalam file ini berdasarkan [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) dan [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.2.1.0] - 2026-08-23 (Agency Accelerator & AI/MCP Engine)

### Added
- **AI Schema Engine & Domain Blueprints**: Engine perancang skema otomatis dengan template siap pakai untuk industri Hotel, E-Commerce, Portal Berita, dan Agensi Digital (`src/lib/ai/schema-engine.ts`, `src/lib/ai/domain-knowledge.ts`).
- **Model Context Protocol (MCP) Server**: Integrasi transport SSE/HTTP native (`/api/mcp/[[...transport]]`) dan manajemen token MCP (`src/actions/mcp-tokens.ts`) untuk asisten coding AI (Cursor, Windsurf, Claude Code).
- **Next.js 16 Starter Project Exporter**: Endpoint export instan (`/api/tenant/[tenant]/ai-builder/export-starter`) yang menghasilkan bundel ZIP Next.js 16 + TailwindCSS v4 + SaCMS SDK terkonfigurasi otomatis.
- **Enterprise License System (Self-Hosted)**: Generator lisensi RSA asymmetric signature untuk Super Admin (`/admin/enterprise/licenses`) dan offline license validator (`src/lib/license.ts`).
- **Agency Wedge Strategy**: Dokumen blueprint posisi pasar dan laporan automated engineering review di `docs/designs/sacms-agency-wedge.md`.

### Fixed & Hardened
- **TypeScript Type Integrity (0 Errors)**: Memperbaiki 18 compile errors pada model Prisma, dynamic validator Zod v4, dan response signature Next.js 16 (`tsc --noEmit` exits 0).
- **Unit Test Suite 100% PASS**: Memperbaiki sinkronisasi mock API token pada `__tests__/api/public-content.test.ts` sehingga seluruh 18 file test (112 unit tests) passing 100%.
- **Dedicated Database Failover Guard**: Menambahkan try/catch dan automatic fallback ke Master DB pada `src/lib/database.ts:getTenantDb` guna mencegah server crash saat koneksi database dedicated tenant enterprise bermasalah.
- **Role Permission Compound Identifiers**: Menyesuaikan compound unique key Prisma (`roleId_permissionId_tenantId`) pada Server Actions roles dan API routes.

### Changed
- Memperbarui komponen UI Dashboard, Content Entries Manager, dan Single Type Editor dengan styling modern berbasis Radix UI dan TailwindCSS v4.
- Menyinkronkan file `VERSION` dan `package.json` ke versi resmi `1.2.1.0`.

---

## [1.2.0.0] - 2026-06-19 (AI, White-Label & Platform Enhancements)

### Added
- **AI Content Generation (DeepSeek V3):** Integrasi AI berbasis DeepSeek V3 (`deepseek-chat`) dengan endpoint `smart-fill`, `generate-schema`, `translate`, dan `summarize`.
- **White-Label & Custom Domain:** Pendaftaran custom domain tenant dengan verifikasi DNS TXT dan pemetaan cache proxy Upstash Redis.
- **Export & Import Workspace:** Export dan import data workspace dalam format JSON/ZIP.
- **Add-on Subscription System:** Add-on storage, AI generation, dan backup database otomatis.
- **Granular Plan Limits Enforcement:** Penegakan batas kuota tenant via `src/lib/plan-enforcement.ts`.

### Changed
- Update limit default untuk paket Free, Starter, Pro, dan Enterprise.
- Transisi AI engine ke model DeepSeek V3 dengan fallback reasoner.

---

## [1.1.0.0] - 2026-06-17 (Major Schema & GraphQL Refactor)

### Added
- **Polymorphic SchemaField**: Unifikasi field skema ContentType, SingleType, dan Component ke model tunggal `SchemaField`.
- **Deep GraphQL Resolution**: Resolusi otomatis relasi dan komponen bersarang pada endpoint GraphQL publik.
- **Single Type Relations**: Dukungan field relasi langsung ke schema Single Type.

---

## [1.0.0.0] - 2026-03-15 (Initial SaaS Headless CMS Launch)

- Multi-tenant data isolation berbasis PostgreSQL & Prisma.
- Content state machine (`DRAFT` → `IN_REVIEW` → `PUBLISHED`).
- Integrasi Cloudflare R2 media storage dengan thumbnail otomatis.
- Public REST API dengan Strapi-style filtering engine.
- Integrasi payment gateway Midtrans untuk tagihan langganan SaaS.
