# Master SDLC Documentation - SaCMS

Selamat datang di direktori dokumentasi resmi SaCMS. Proyek ini dipatenkan dalam **11 Dokumen Inti** yang mematuhi standar 10 Tahap SDLC (*Software Development Life Cycle*), mulai dari fase inisiasi hingga fase pemeliharaan (*maintenance*).

Setiap tahapan dirangkum secara rapi tanpa tumpang tindih untuk merepresentasikan arsitektur *SaaS Headless CMS* sejati.

---

## Indeks Dokumen Resmi (01 - 11)

### 📊 Fase Perencanaan & Analisis
Tahap ini mencakup latar belakang bisnis, justifikasi teknis, serta batasan fungsional/non-fungsional dari SaCMS.
1. 📄 **[01-Business_Requirement_Document.md](./01-Business_Requirement_Document.md)**: Tujuan bisnis, masalah utama, KPI, *stakeholders*, dan cakupan (*scope*).
2. 📄 **[02-Software_Requirement_Specification.md](./02-Software_Requirement_Specification.md)**: Kebutuhan fungsional lengkap, *User Roles* (RBAC), *Business Rules*, keamanan, dan *Non-Functional Requirements* (NFR).

### 🏗️ Fase Desain & Spesifikasi Sistem
Rancangan arsitektur perangkat lunak, isolasi data, dan struktur API eksternal.
3. 📄 **[03-Technical_Design_Document.md](./03-Technical_Design_Document.md)**: Arsitektur *Monolithic-Serverless* (Next.js), *Data Flow Diagram* (DFD), arsitektur modul, struktur *Route Groups* (`public`, `workspace`, dll), serta *Database ERD*.
4. 📄 **[04-API_Specification.md](./04-API_Specification.md)**: Panduan *endpoint* publik (REST & GraphQL), mekanisme *filtering* ala Strapi, otentikasi Bearer Token. *(Tersedia juga format Swagger: **[04-openapi.yaml](./04-openapi.yaml)**)*.

### 👨‍💻 Fase Pengembangan & Pengujian
Pedoman internal bagi *Developer* yang ingin mengelola, berkontribusi, dan memastikan keandalan *codebase*.
5. 📄 **[05-Development_Guidelines.md](./05-Development_Guidelines.md)**: Standar penulisan kode (TypeScript, *Naming Conventions*), struktur *folder*, integrasi Next.js mutakhir, dan panduan kontribusi (*Git Workflow*).
6. 📄 **[06-Testing_Plan.md](./06-Testing_Plan.md)**: Skenario pengujian (*Unit test* menggunakan Vitest, dan *E2E test* menggunakan Playwright).

### 🚀 Fase Deployment, Operasional & Keamanan
Panduan pelepasan perangkat lunak ke *Production* serta penanganan insiden harian.
7. 📄 **[07-Deployment_Guide.md](./07-Deployment_Guide.md)**: Strategi peluncuran (Production via Vercel, Self-hosted via Docker Compose) dan pengaturan CI/CD pipelines.
8. 📄 **[08-Operations_and_Runbook.md](./08-Operations_and_Runbook.md)**: Pedoman *Troubleshooting* cepat untuk layanan *PostgreSQL, Redis, R2*, manajemen pemeliharaan rutin (*Cron jobs*), dan templat pelaporan insiden.
9. 📄 **[09-Security_Policy.md](./09-Security_Policy.md)**: Arsitektur *hashing* API Token, pencegahan SQL Injection (Prisma), *Rate Limiting* (Upstash Redis), dan isolasi *multi-tenant*.

### 📦 Pemeliharaan & Pengguna Akhir
Manajemen pembaruan jangka panjang dan manual tutorial teknis bagi klien B2B.
10. 📄 **[10-Release_Notes.md](./10-Release_Notes.md)**: Sistem pelacakan rilis versi (Changelog) dan *Change Request* (CR) berdasarkan standar *Semantic Versioning*.
11. 📄 **[11-User_Manual_and_Integrations.md](./11-User_Manual_and_Integrations.md)**: Panduan tata cara pengguna (*end-user*), pengaturan skema dinamis (*Content Types*), dan rincian alur pembayaran/berlangganan menggunakan Midtrans Snap API.

---
*Seluruh dokumen di folder ini bersifat **Final** dan secara akurat mencerminkan implementasi kode SaCMS.*
