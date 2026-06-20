# Business Requirement Document (BRD)
**Project Name:** SaCMS (SaaS Headless CMS)
**Date:** 17 Juni 2026
**Status:** Approved business direction; implementation status is tracked separately in document 15

> Sections that mention “v1.0” preserve the original launch scope. They are not a statement that acceptance metrics were measured on the current repository baseline.

---

## 1. Latar Belakang Proyek
Di era digital modern, kebutuhan akan sistem manajemen konten (CMS) yang fleksibel (*headless*) semakin tinggi. Strapi saat ini mendominasi pasar *open-source headless CMS*, namun Strapi memiliki kelemahan fundamental bagi agensi, *startup*, dan pengembang independen: **ketiadaan arsitektur multi-tenant bawaan** dan **tidak adanya sistem billing/langganan yang terintegrasi**. 

Organisasi yang ingin menyediakan layanan CMS untuk banyak klien harus melakukan *self-hosting* instance Strapi secara terpisah untuk setiap klien, yang mana sangat tidak efisien dari sisi biaya infrastruktur dan pemeliharaan (DevOps). Oleh karena itu, SaCMS diinisiasi untuk menjembatani celah pasar ini dengan membangun CMS *multi-tenant* sejati berbasis SaaS.

## 2. Tujuan Bisnis (Business Objectives)
1. **Efisiensi Infrastruktur:** Mengurangi biaya *hosting* dan pemeliharaan DevOps hingga 80% dengan menggabungkan semua klien (*tenant*) ke dalam satu *codebase* dan *database* terpusat dengan isolasi data yang ketat.
2. **Monetisasi Otomatis:** Memungkinkan pemilik platform (*Solo Developer / Agency*) untuk memonetisasi layanan CMS langsung ke klien mereka melalui sistem langganan (*subscription*) SaaS yang otomatis dan terintegrasi dengan Midtrans.
3. **Pengalaman Pengembang (DX):** Menyediakan API Publik dan SDK yang sangat cepat (*Edge-optimized*) sehingga para pengembang *frontend* dapat dengan mudah membangun *website* atau aplikasi menggunakan data dari SaCMS.

## 3. Masalah yang Ingin Diselesaikan
1. Sulitnya mengelola puluhan instance CMS yang terpisah untuk banyak klien (*client fragmentation*).
2. Kebocoran data lintas klien saat mencoba membuat CMS *multi-tenant* secara manual di atas platform yang tidak mendukungnya secara *native*.
3. Kerumitan mengintegrasikan *payment gateway* (terutama untuk pasar Asia Tenggara / Indonesia seperti Midtrans) untuk menagih biaya layanan CMS kepada klien.
4. Performa API publik yang lambat (waterfall requests) dari CMS tradisional, diselesaikan melalui optimasi Next.js Server Components dan React Suspense.

## 4. Stakeholder
| Nama / Peran | Deskripsi Tanggung Jawab |
|--------------|--------------------------|
| **System Architect / Solo Founder** | Penggagas ide, perancang arsitektur, dan pembuat keputusan teknologi utama. |
| **Startup CTO / Tech Lead** | Calon pelanggan utama (B2B) yang akan berlangganan SaCMS untuk tim mereka. |
| **Content Manager (End-User)** | Pengguna akhir dari klien yang akan menggunakan panel *dashboard* harian untuk menulis artikel/konten. |
| **Agency Owner** | Klien B2B yang akan menggunakan fitur *multi-tenant* untuk mengelola aset digital klien-klien mereka. |

## 5. KPI & Success Criteria
Proyek ini dianggap sukses jika peluncuran versi 1.0 (MVP) memenuhi metrik berikut:

| Key Performance Indicator (KPI) | Target (Success Criteria) | Timeframe |
|---------------------------------|---------------------------|-----------|
| **API Latency (Performance)** | Waktu respons API Publik < 200ms (P95) untuk tabel berisi 10K entri data. | Launch (v1.0) |
| **Multi-Tenant Isolation** | 0% insiden kebocoran data (*data leakage*) antar Tenant/Workspace. | Launch (v1.0) |
| **Workflow Adoption** | 100% *Content Types* mendukung alur draf, ulasan, publikasi, dan arsip. | Launch (v1.0) |
| **Media Upload Speed** | Kurang dari 3 detik untuk mengunggah dan memproses aset (R2) berukuran 10MB. | Launch (v1.0) |
| **System Uptime** | Ketersediaan layanan mencapai 99.5% tanpa kegagalan *database pool*. | Bulan Pertama |

KPI performa, upload, uptime, dan zero-leakage memerlukan bukti hasil uji/monitoring. Audit sinkronisasi 19 Juni 2026 tidak menjalankan pengukuran tersebut.

## 6. Scope (Ruang Lingkup)

### In Scope (Termasuk dalam Proyek v1.0)
- Sistem *Workspace* (Multi-tenant) murni dengan isolasi data tingkat ORM (Prisma).
- *Content Builder* dinamis (Collection Types & Single Types).
- Manajemen konten i18n (Multibahasa).
- Workflow konten (Draft, In Review, Published, Scheduled, Archived).
- API Publik berbasis REST & GraphQL dengan mesin *filtering* (ops: `$eq`, `$contains`, dll).
- Integrasi Cloudflare R2 untuk penyimpanan media (gambar/video).
- Integrasi Midtrans Snap API untuk pembayaran langganan SaaS bulanan.
- Webhook sinkron (*Sync Hooks* untuk validasi pre-save) dan asinkron (DLQ).
- Rate Limiting berbasis Edge (Upstash Redis).

### Out of Scope (Di Luar Ruang Lingkup v1.0)
Berikut adalah fitur yang **TIDAK** akan dibangun pada peluncuran pertama ini:
- Opsi implementasi *Self-Hosted* murni (Fokus utama adalah SaaS).
- *Real-time collaborative editing* ala Google Docs (karena kompleksitas CRDT).
- UI *Plugin Marketplace* pihak ketiga.
- Custom Domain atau *White-labeling* penuh (akan dialokasikan untuk versi 1.1 / Enterprise).
- Dukungan *database* selain PostgreSQL (seperti MySQL atau MongoDB).

## 7. Current Product Expansion

Setelah scope MVP awal, codebase telah menambahkan atau memperluas:

- Sequential content review dan reviewer assignment.
- AI authoring berbasis DeepSeek/add-on.
- White-Label branding dan satu Custom Domain per tenant.
- Export/import, monitoring, audit trail, and plan overrides.
- Optional dedicated PostgreSQL URL per tenant.
- Dynamic GraphQL relation/component resolution.

Status dan batas tiap kemampuan berada di [15-Implementation_Traceability.md](./15-Implementation_Traceability.md); workflow normatif berada di [14-Content_Workflow_and_Approval.md](./14-Content_Workflow_and_Approval.md).
