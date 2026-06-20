# Master SDLC Documentation - SaCMS

Selamat datang di direktori dokumentasi resmi SaCMS. Direktori ini memuat **15 dokumen inti** yang menghubungkan kebutuhan bisnis, desain, kontrak API, operasi, panduan pengguna, workflow, dan status implementasi.

> **Status dokumentasi:** *living documentation*. Dokumen disinkronkan melalui audit statis pada 19 Juni 2026. Audit ini tidak menjalankan test, build, lint, migrasi, atau panggilan layanan eksternal. Lihat [15-Implementation_Traceability.md](./15-Implementation_Traceability.md) untuk batas implementasi yang sudah terkonfirmasi.

---

## Indeks Dokumen Resmi (01 - 15)

### 📊 Fase Perencanaan & Analisis
1. 📄 **[01-Business_Requirement_Document.md](./01-Business_Requirement_Document.md)**: Tujuan bisnis, masalah utama, KPI, *stakeholders*, dan cakupan (*scope*).
2. 📄 **[02-Software_Requirement_Specification.md](./02-Software_Requirement_Specification.md)**: Kebutuhan fungsional lengkap, *User Roles* (RBAC), *Business Rules*, keamanan, dan *Non-Functional Requirements* (NFR).

### 🏗️ Fase Desain & Spesifikasi Sistem
3. 📄 **[03-Technical_Design_Document.md](./03-Technical_Design_Document.md)**: Arsitektur *Monolithic-Serverless* (Next.js), *Data Flow Diagram* (DFD), arsitektur modul, struktur *Route Groups*, serta *Database ERD*.
4. 📄 **[04-API_Specification.md](./04-API_Specification.md)**: Panduan **lengkap** endpoint (Public REST & GraphQL, Tenant Management API, AI Endpoints, Cron, dan Webhooks). *(Tersedia juga format Swagger: **[04-openapi.yaml](./04-openapi.yaml)**)*

### 👨‍💻 Fase Pengembangan & Pengujian
5. 📄 **[05-Development_Guidelines.md](./05-Development_Guidelines.md)**: Standar penulisan kode (TypeScript, *Naming Conventions*), struktur *folder*, integrasi Next.js, dan panduan kontribusi (*Git Workflow*).
6. 📄 **[06-Testing_Plan.md](./06-Testing_Plan.md)**: Skenario pengujian (*Unit test* via Vitest, dan *E2E test* via Playwright).

### 🚀 Fase Deployment, Operasional & Keamanan
7. 📄 **[07-Deployment_Guide.md](./07-Deployment_Guide.md)**: Strategi peluncuran (Vercel, Docker Compose), **CI/CD GitHub Actions**, daftar lengkap *Environment Variables*, dan *Database Migration*.
8. 📄 **[08-Operations_and_Runbook.md](./08-Operations_and_Runbook.md)**: Pedoman *Troubleshooting* untuk PostgreSQL, Redis, R2, Webhook DLQ, dan templat pelaporan insiden.
9. 📄 **[09-Security_Policy.md](./09-Security_Policy.md)**: Arsitektur RBAC, API Token hashing, SQL Injection prevention, *Rate Limiting*, *Security Headers*, White-Label domain security, dan audit logging.

### 📦 Pemeliharaan & Pengguna Akhir
10. 📄 **[10-Release_Notes.md](./10-Release_Notes.md)**: Changelog versi (v1.0.0 → v1.2.0) berdasarkan *Semantic Versioning*.
11. 📄 **[11-User_Manual_and_Integrations.md](./11-User_Manual_and_Integrations.md)**: Panduan pengguna (*end-user*), pengaturan skema dinamis (*Content Types*), dan rincian alur pembayaran Midtrans.

### 🤖 Fitur Lanjutan
12. 📄 **[12-AI_Integration.md](./12-AI_Integration.md)**: Panduan AI Content Generation berbasis DeepSeek V3 — konfigurasi, semua endpoint AI (`smart-fill`, `translate`, `generate-schema`, dll), retry logic, dan batasan penggunaan.
13. 📄 **[13-White_Label_and_Custom_Domain.md](./13-White_Label_and_Custom_Domain.md)**: Panduan White-Label branding dan Custom Domain routing — konfigurasi DNS, cara kerja proxy middleware, dan plan limits.

### 🔄 Workflow & Sinkronisasi Implementasi
14. 📄 **[14-Content_Workflow_and_Approval.md](./14-Content_Workflow_and_Approval.md)**: Sumber kebenaran status konten, transisi, role, review berurutan, scheduling, validasi, webhook, dan cache.
15. 📄 **[15-Implementation_Traceability.md](./15-Implementation_Traceability.md)**: Matriks fitur yang sudah aktif, batasannya, sumber implementasi, dan prosedur menjaga docs-kode tetap sinkron.

---
Urutan membaca yang disarankan untuk pengembangan fitur adalah **02 → 14 → 15 → 03 → 04 → 11**. Jika terdapat konflik, gunakan hierarki sumber kebenaran pada dokumen 15 dan perbaiki dokumen yang tertinggal pada perubahan yang sama.
