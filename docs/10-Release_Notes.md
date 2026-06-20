# Release Notes & Change Request (Changelog)

Semua perubahan penting (*major*, *minor*, dan *patch*) pada proyek SaCMS didokumentasikan dalam file ini. Format pembuatan rilis ini didasarkan pada [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

Kami menggunakan **Semantic Versioning** (`MAJOR.MINOR.PATCH`).

> Product release labels below are historical/product-facing labels. The repository `package.json` is currently `0.2.0`; version streams should be reconciled before the next formal release. A changelog entry confirms code presence, not that test/build acceptance passed.

---

## [Unreleased] - Documentation & Workflow Synchronization

### Added
- Pure shared content workflow rules and detailed workflow/approval documentation.
- Reviewer decision endpoint and in-editor sequential review controls.
- Implementation traceability matrix distinguishing implemented, partial, planned, and historical capabilities.

### Changed
- Content status options now follow the current role and valid transition.
- Draft content defers required-field validation; non-draft states enforce required fields.
- Scheduling requires a valid future date and supports owner/admin direct scheduling from Draft.
- AI and White-Label/Custom Domain routes consistently enforce their feature/plan gates.
- Public API authentication and status authorization occur before cache lookup.
- Read-only Public API tokens cannot request or populate non-published content.
- Developer prompt export now uses a token placeholder and no longer exposes the stored SHA-256 token hash as if it were a usable credential.
- API token list/create metadata and GraphQL Explorer no longer expose or auto-inject stored token hashes; users paste the one-time plaintext token into Sandbox headers.
- Retired the unauthenticated legacy `/addons/ai` mock endpoint with HTTP 410 in favor of the gated Smart Fill endpoint.
- Custom role routes now use `TenantRole`, reserve every built-in role slug, and share the canonical workflow permission identifiers used by the editor and server rules.
- Custom-domain cache mappings are removed when a domain is cleared, replaced, pending verification, or fails verification; only verified domains are routed.
- New locale variants now pass the same initial-status authorization as ordinary entry creation, closing a translation-based publish/schedule bypass.
- Public API locale fallback now works for empty locale data and keeps fallback/locale metadata restricted to published variants for read-only tokens.
- Public Single Type cache entries are separated by tenant, locale, and token type after authentication; `read-only` tokens only see published variants.
- Component deletion now checks schema-field references on the server and keeps the Components UI fresh after a successful delete.
- API, deployment, security, AI, domain, user, and architecture documents were synchronized with current route methods and constraints.

### Verification
- Static inspection only. No test, build, lint, migration, E2E, or external integration call was run for this synchronization.

---

## [1.2.0] - 2026-06-19 (AI, White-Label & Platform Enhancements)

### Added
- **AI Content Generation (DeepSeek V3):** Integrasi AI berbasis DeepSeek V3 (`deepseek-chat`) dengan fallback ke `deepseek-reasoner`. Fitur mencakup:
  - `smart-fill`: Auto-fill seluruh field entry dari deskripsi singkat.
  - `generate-schema`: Generate definisi Content Type dari natural language.
  - `translate`: Terjemahan konten ke locale target.
  - `summarize`: Ringkasan otomatis konten panjang.
- **White-Label & Custom Domain:** Tenant dapat mendaftarkan custom domain dan mengkustomisasi branding (logo, warna, nama aplikasi).
- **Export & Import:** Endpoint untuk mengekspor dan mengimpor data workspace dalam format JSON/ZIP.
- **Add-on System:** Sistem add-on berbasis subscription (AI generation `ai-gen`, extra storage `storage-10gb`, backup `backup`).
- **Monitoring Dashboard:** Endpoint `/api/admin/monitoring/metrics` dan `/api/admin/monitoring/requests` untuk memantau performa sistem.
- **Cron Backup:** Endpoint `/api/cron/backup` untuk backup database otomatis ke Cloudflare R2.
- **Plan Enforcement:** Sistem enforcement limit plan yang lebih granular via `lib/plan-enforcement.ts` (mencakup content types, entries, members, storage, locales).
- **Custom Plan Override:** Super Admin dapat mengoverride limit plan individual tenant melalui `CustomPlanOverride`.
- **Developer Tools:** Endpoint `/api/tenant/[tenant]/developer/openapi` untuk generate spesifikasi OpenAPI tenant secara otomatis.

### Changed
- **AI Provider:** Beralih dari OpenAI GPT ke **DeepSeek V3** sebagai model default. Env var berubah dari `OPENAI_API_KEY` menjadi `DEEPSEEK_API_KEY`.
- **Plan Limits:** Update limit default untuk setiap tier (lihat `lib/tenant-plan.ts`):
  - Free: 3 Content Types, 500 Entries, 1 Member, 100MB Storage
  - Starter: 5 Content Types, 5.000 Entries, 3 Members, 1GB Storage
  - Pro: 10 Content Types, 10.000 Entries, 10 Members, 5GB Storage
  - Enterprise: 20 Content Types, 20.000 Entries, 20 Members, 10GB Storage

### Fixed
- Fixed `global-error.tsx` missing `</body>` dan `</html>` closing tags (Turbopack build error).

---

## [1.1.0] - 2026-06-17 (Major Architecture Refactor)


### Added
- **Unified Schema Fields**: Refactored `ContentTypeField`, `SingleTypeField`, and `ComponentField` into a single polymorphic `SchemaField` model in Prisma.
- **Component Impact Analysis**: Added visibility in the Components UI to show `usedByCount` (how many fields use a given component). Added warnings before deletion to prevent schema breakage.
- **Single Type Relations**: Relation fields can now directly target `SingleType` schemas in addition to `ContentType` schemas.
- **Deep GraphQL Resolution**: Enhanced the `graphql-schema.ts` to automatically populate nested components and relation fields.

---

## [1.0.0] - 2026-03-15 (Launch MVP Target)

Versi produksi pertama dari sistem SaCMS yang diposisikan sebagai alternatif *Headless CMS* multi-tenant berbasis Next.js.

### Added
- **Multi-Tenant Workflow:** Isolasi data murni melalui PostgreSQL Prisma dengan *TenantID check*.
- **Content State Machine:** Fitur draf, review, dan publikasi (`DRAFT` → `IN_REVIEW` → `PUBLISHED`).
- **Media CDN integration:** Sinkronisasi langsung ke Cloudflare R2 dengan fitur kompresi *thumbnail* bawaan.
- **Advanced Filtering API:** Strapi-style operator query string (contoh: `?filters[price][$gt]=100`).
- **Subscription Billing:** Integrasi *payment gateway* Midtrans untuk mengelola langganan (Free, Starter, Pro, Enterprise).
- **i18n Localization:** Fitur dukungan multibahasa untuk field bertipe `localizable=true`.
- **GraphQL API:** Endpoint mutasi (*create, update, delete*) berbasis GraphQL yang terintegrasi dengan generator dinamis skema Prisma.
- **Sync Hooks:** Webhook berjenis sinkron (`content.beforeCreate`, dll) yang dapat memblokir mutasi.
- **Edge Rate Limiting:** Memanfaatkan Upstash Redis untuk proteksi *brute-force* dan efisiensi API Publik.

### Security
- Penerapan SHA-256 Hashing untuk performa pencarian `API Token` O(1) yang efisien.
- Ekstensifikasi *Zod Input Validation* di seluruh rute Handler API.

---

## Template Change Request (CR)

Jika pengguna/klien ingin mengajukan perubahan signifikan pada struktur database atau aliran kerja (*workflow*), tim akan menggunakan format **Change Request** berikut sebelum dikerjakan:

```markdown
# Change Request: [Nama Perubahan]
**CR ID:** CR-001
**Pemohon:** [Nama / Role]
**Target Rilis:** v1.1.0

### Deskripsi Perubahan
[Contoh: Penambahan fitur AI content generation yang terintegrasi dengan OpenAI langsung di dalam Text Editor]

### Dampak (Impact Analysis)
- **Database:** Perlu tabel `AiLog` untuk mencatat jumlah token pemakaian per Tenant.
- **UI/UX:** Terdapat tombol `Generate with AI` di komponen `RichTextEditor`.
- **Cost:** Biaya per-API call ke OpenAI yang akan di-*charge* ke *billing* klien.

### Approval Status
[ ] Approved by Tech Lead
[ ] Approved by Product Owner
```
