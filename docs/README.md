# SaCMS Documentation Hub

Selamat datang di direktori dokumentasi resmi SaCMS. Semua dokumen teknis, dari fase perancangan hingga pemeliharaan sistem (Software Development Life Cycle - SDLC), dapat diakses melalui tautan-tautan di bawah ini. Dokumen-dokumen ini dirancang untuk memastikan kode sumber (*codebase*) yang ada saat ini direfleksikan dengan akurat.

## 1. Product Requirements & Specifications
- 📄 **[Product Requirements Document (PRD)](./prd.md)**: Dokumen utama yang mencakup fitur, Epic, User Stories, kriteria sukses, dan secara eksplisit merinci operasi CRUD dan Workflow State Machine.

## 2. Fase Perancangan (Architecture & Design)
- 🏗️ **[System Architecture](./architecture.md)**: Arsitektur level tinggi, integrasi *Server Components*, isolasi data multi-tenant, dan arsitektur *Edge*.
- 🔄 **[Data Flow Diagram (DFD)](./dfd.md)**: Visualisasi Mermaid yang menunjukkan aliran data antara User, Admin, API, Webhooks, dan Midtrans. Termasuk aliran *Server Actions*.
- 🗄️ **[Database ERD](./database_erd.md)**: Skema relasional PostgreSQL (Prisma), mencakup entitas Tenants, Content Types, Entries, Media, Webhooks, dan API Tokens.

## 3. Fase Implementasi (Developer Guides)
- 🔌 **[API Reference / OpenAPI](./API_REFERENCE.md)**: Panduan lengkap endpoint *Public REST API*. 
  *(Lihat juga versi YAML di [`openapi.yaml`](./openapi.yaml) untuk integrasi dengan Swagger UI)*
- 🛠️ **[Content Types Setup](./CONTENT_TYPES_SETUP.md)**: Panduan mendefinisikan *schema builder* dinamis dan Fields.
- 💳 **[Midtrans Integration](./MIDTRANS_INTEGRATION.md)**: Panduan implementasi siklus penagihan dan langganan dengan gateway pembayaran Midtrans.
- 🛡️ **[Security Policy](./security_policy.md)**: Konvensi keamanan, manajemen *secret*, dan algoritma enkripsi (seperti SHA-256 untuk API Tokens).

## 4. Fase Pengujian (Testing)
- 🧪 **[Testing Plan & QA Guide](./testing_plan.md)**: Strategi pengujian SaCMS. Mencakup Unit Testing (menggunakan Vitest) dan End-to-End Testing (menggunakan Playwright), serta konfigurasi *mock session* untuk melintasi validasi langganan.

## 5. Fase Pemeliharaan & Operasional (Maintenance)
- 🔧 **[Maintenance Guide](./maintenance.md)**: Panduan *troubleshooting* umum, *Cron jobs* (termasuk antrian jadwal *publish* & *Dead Letter Queue* webhook), Sentry monitoring, serta perintah *backup* database.
- 🚀 **[Deployment Guide](./deployment.md)**: Instruksi *deploy* ke penyedia Vercel atau *Self-Hosted* via Docker Compose.

---
*Dokumen-dokumen di folder ini senantiasa disinkronisasikan dan mencerminkan implementasi kode secara _real-time_.*
