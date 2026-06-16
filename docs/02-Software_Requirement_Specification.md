# Software Requirement Specification (SRS)
**Project Name:** SaCMS (SaaS Headless CMS)
**Date:** 17 Juni 2026
**Status:** Approved

Dokumen ini mendeskripsikan kebutuhan perangkat lunak untuk sistem SaCMS, mencakup fungsionalitas utama, batasan non-fungsional, keamanan, serta peran pengguna di dalam sistem.

---

## 1. Functional Requirements (Kebutuhan Fungsional)

1. **Manajemen *Tenant* & *Workspace***
   - Sistem harus memungkinkan pengguna mendaftar dan membuat *Workspace* baru.
   - Sistem harus menyajikan dasbor manajemen langganan terintegrasi dengan Midtrans.
2. ***Content Modeling* (Pembuatan Skema)**
   - Sistem harus mengizinkan Admin untuk mendefinisikan struktur *Database* dinamis berupa *Collection Types* dan *Single Types*.
   - Sistem harus mengizinkan konfigurasi tipe *Field* (Teks, Angka, Tanggal, Relasi, Media, Boolean).
3. **Manajemen Konten & Alur Kerja (*Workflow*)**
   - Sistem harus mendukung pembuatan, pengubahan, dan penghapusan data konten (CRUD).
   - Sistem harus mengimplementasikan status konten: `DRAFT`, `IN_REVIEW`, `APPROVED`, `SCHEDULED`, `PUBLISHED`, `ARCHIVED`, `REJECTED`.
   - Sistem harus mendukung lokalisasi (i18n) sehingga konten dapat diterjemahkan ke beberapa bahasa berdasarkan `locale`.
4. **Media *Library***
   - Sistem harus mengizinkan pengguna untuk mengunggah aset media (gambar, dokumen) dengan limit 10MB per berkas.
   - Sistem harus menghasilkan versi gambar *thumbnail* (150px) dan *medium* (600px) secara otomatis ke Cloudflare R2.
5. **API Konsumsi Publik (REST & GraphQL)**
   - Sistem harus menyediakan *Endpoint* REST untuk klien Publik dengan filter gaya Strapi (`?filters[price][$gt]=100`).
   - Sistem harus menyediakan *Endpoint* GraphQL untuk *Query* maupun *Mutation* data konten.
   - Sistem harus mendukung pencarian teks penuh (*Full-Text Search*).
6. **Integrasi Eksternal (*Webhooks*)**
   - Sistem harus dapat memicu *Webhook* Asinkron ke URL kustom ketika sebuah *event* terjadi.
     - **Daftar Event:** `content.entry.created`, `content.entry.updated`, `content.entry.deleted`, `content.entry.published`.
     - **Struktur Payload:** `{"event": "content.entry.published", "tenantId": "...", "data": { ... }}`
   - Sistem harus mendukung *Sync Hooks* untuk mencegat atau mengubah data sebelum masuk ke basis data (`beforeCreate`, `beforeUpdate`).

7. **Validasi Skema Lapis Tengah (Zod Validation)**
   - Semua rute API (baik REST maupun Server Actions) wajib melewati `Zod.parse()`.
   - Payload input untuk konten harus memvalidasi bentuk tipe dinamis (contoh: teks dibatasi panjangnya, tipe relasi dipastikan valid UUID-nya) sebelum ORM menyentuh database.

---

## 2. User Roles (Peran Pengguna)

| Peran (Role) | Hak Akses dan Tanggung Jawab |
|--------------|------------------------------|
| **Super Admin** | Mengelola seluruh infrastruktur (platform) SaCMS, melihat metrik global, dan mengatur sistem *plan/billing* induk. |
| **Tenant Owner / Admin** | Memiliki akses tak terbatas pada satu *Workspace*. Dapat mengundang anggota tim, mengelola penagihan/langganan, mengubah konfigurasi batas API, serta memodifikasi struktur *Content Type*. |
| **Editor** | Dapat membuat, mengubah, menerbitkan, dan menghapus *Content Entries* serta mengunggah media, namun TIDAK dapat memodifikasi struktur skema (*Content Type*) atau melakukan pengaturan konfigurasi proyek. |
| **Member / Reviewer** | Dapat membaca dan membuat entri berstatus `DRAFT`, namun hanya bisa mengirimkannya ke fase `IN_REVIEW` (tidak memiliki akses ke tombol *Publish*). |
| **API Consumer** | *System/Client* eksternal yang membaca *Endpoint* publik menggunakan `API Token` terbatas (*Read-only* atau *Full-access*). |

---

## 3. Business Rules (Aturan Bisnis)

1. **Multi-Tenant Data Isolation:** Sebuah *query* pada sistem wajib menginjeksikan pemeriksa `tenantId`. Data dari `Tenant A` sama sekali tidak boleh diakses, dilihat, atau direferensikan oleh `Tenant B`.
2. **Validasi Skema Fleksibel:** Pengguna dapat menyimpan *Content Entry* meski kosong **hanya jika** statusnya adalah `DRAFT`. Jika diubah menjadi `PUBLISHED`, mesin validasi Zod akan mengeksekusi pemeriksaan pada *Fields* yang bertanda *Required*.
3. **Pembatasan Langganan (Plan Limits & Rate Limiting):**
   - Setiap *Workspace* tunduk pada batas langganannya. 
   - **Metrik Edge Rate Limiting (via Upstash Redis):**
     - Paket *Free*: Max 100 API Requests/menit.
     - Paket *Pro*: Max 500 API Requests/menit.
     - Paket *Enterprise*: Custom limits.
   - Sistem akan memblokir *request* (*HTTP 429 Too Many Requests*) pada tingkat Edge Middleware sebelum *request* mencapai basis data PostgreSQL.

---

## 4. Security Requirements (Kebutuhan Keamanan)

1. **Autentikasi & Sesi:** Menggunakan NextAuth.js terintegrasi dengan adapter Prisma untuk pelacakan sesi pengguna.
2. **Kriptografi API Token:** Setiap `API Token` (`cf_xxxx`) yang di-*generate* tidak boleh disimpan langsung. Token harus di-*hash* menggunakan algoritma `SHA-256` di basis data.
3. **Proteksi Injeksi SQL:** Semua *input filtering* dinamis (seperti `$eq` atau `$contains`) wajib dikompilasi menggunakan logika parameterisasi (*Parameterized SQL/Query*) via `lib/filters.ts` sebelum dilempar ke basis data PostgreSQL.
4. **Proteksi Lintas Situs:** API publik dan internal harus terlindungi dari CSRF, dan memberlakukan kontrol ketat pada *CORS Headers* (dikonfigurasi dalam `middleware.ts`).

---

## 5. Non-Functional Requirements

1. **Toleransi Kesalahan (Fault Tolerance):** Kegagalan integrasi *Webhook* tidak boleh membatalkan *Request* utama klien. Kesalahan *outbound webhook* dipindahkan ke antrian *Dead Letter Queue* (DLQ) untuk *retries* berkala.
2. **Pemeliharaan (Maintainability):** Antarmuka internal pengembang menggunakan arsitektur modular yang membagi `public/[tenant]`, `tenant/[tenant]`, dan struktur UI menggunakan *route groups* (`(public)`, `(content)`, `(system)`, `(workspace)`, `(billing)`) agar modifikasi *logic* tidak saling mengunci.
3. **Dukungan Tipe Statis (Type Safety):** Semua operasi internal menggunakan TypeScript 100%, beserta *Types* otomatis yang digenerasi oleh Prisma.

---

## 6. Performance Requirements (Kebutuhan Kinerja)

1. **Kecepatan API:** Layanan respons API Publik (REST/GraphQL) harus merespons dalam waktu `< 200 milidetik` (P95) pada pembacaan daftar yang memiliki relasi berkedalaman sedang (kedalaman = 1).
2. **Manajemen Beban (Rate Limiting):** API harus sanggup menahan lonjakan *traffic* menggunakan penyangga berbasis memori *Edge* Upstash Redis sebelum meneruskannya ke mesin basis data utama.
3. **Penyajian Media Instan:** Semua muatan media statis (*image/video*) dikembalikan kepada klien bukan melalui basis data (bukan *Base64*), melainkan disajikan secara langsung dari *Edge Network* CDN Cloudflare R2 untuk kecepatan *caching* global.
