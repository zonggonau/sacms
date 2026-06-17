# Release Notes & Change Request (Changelog)

Semua perubahan penting (*major*, *minor*, dan *patch*) pada proyek SaCMS didokumentasikan dalam file ini. Format pembuatan rilis ini didasarkan pada [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

Kami menggunakan **Semantic Versioning** (`MAJOR.MINOR.PATCH`).

---

## [1.0.0] - 2026-03-15 (Launch MVP Target)

Versi produksi pertama dari sistem SaCMS yang diposisikan sebagai alternatif *Headless CMS* multi-tenant berbasis Next.js.

### Added
- **Multi-Tenant Workflow:** Isolasi data murni melalui PostgreSQL Prisma dengan *TenantID check*.
- **AI Content Generate:** Dukungan pembuatan teks dan draft otomatis di *Rich Text Editor* berbasis Deepseek.
- **AI Schema Generate:** Generator skema dinamis untuk mempermudah perancangan tipe konten.
- **Format Surat Placeholder:** Konfigurasi *placeholder* untuk templat dokumen surat yang diakses melalui *modal* tipe *field* `format surat`.
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
[Contoh: Penambahan fitur AI content generation yang terintegrasi dengan Deepseek langsung di dalam Text Editor]

### Dampak (Impact Analysis)
- **Database:** Perlu tabel `AiLog` untuk mencatat jumlah token pemakaian per Tenant.
- **UI/UX:** Terdapat tombol `Generate with AI` di komponen `RichTextEditor`.
- **Cost:** Biaya per-API call ke Deepseek yang akan di-*charge* ke *billing* klien.

### Approval Status
[ ] Approved by Tech Lead
[ ] Approved by Product Owner
```
