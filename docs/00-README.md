# Master SDLC Documentation - SaCMS

Selamat datang di direktori dokumentasi resmi **SaCMS (v1.2.1.0)** — SaaS Headless CMS multi-tenant berbasis Next.js 16 (App Router) dengan native billing (Midtrans), AI-powered schema engine, Model Context Protocol (MCP), dan Enterprise self-hosting.

> **Status dokumentasi:** *Living documentation*. Tersinkronisasi penuh dengan struktur codebase aktif, route handlers, database models, server actions, dan komponen UI pada **23 Agustus 2026**.

---

## 📚 Indeks Dokumen Resmi (01 - 15)

### 📊 Fase Perencanaan & Analisis
1. 📄 **[01-Business_Requirement_Document.md](./01-Business_Requirement_Document.md)**: Tujuan bisnis, value proposition agensi web, target KPI, *stakeholders*, dan cakupan (*scope*).
2. 📄 **[02-Software_Requirement_Specification.md](./02-Software_Requirement_Specification.md)**: Kebutuhan fungsional lengkap, *User Roles* (RBAC), *Business Rules*, keamanan, AI protocol, dan *Non-Functional Requirements* (NFR).

### 🏗️ Fase Desain & Spesifikasi Sistem
3. 📄 **[03-Technical_Design_Document.md](./03-Technical_Design_Document.md)**: Arsitektur *Modular Monolith* (Next.js 16), *Data Flow Diagram* (DFD), struktur *Route Groups*, *Database ERD*, MCP Tool Protocol, dan Dedicated DB Routing.
4. 📄 **[04-API_Specification.md](./04-API_Specification.md)**: Panduan **lengkap** endpoint (Public REST & GraphQL, Tenant Management API, MCP Transport API, AI Schema Builder, Starter Exporter, Cron, dan Webhooks). *(Tersedia juga format Swagger: **[04-openapi.yaml](./04-openapi.yaml)**)*

### 👨‍💻 Fase Pengembangan & Pengujian
5. 📄 **[05-Development_Guidelines.md](./05-Development_Guidelines.md)**: Standar penulisan kode (TypeScript, Zod v4, *Naming Conventions*), struktur *folder*, integrasi Next.js 16 App Router, dan panduan kontribusi (*Git Workflow*).
6. 📄 **[06-Testing_Plan.md](./06-Testing_Plan.md)**: Skenario pengujian (*Unit test* via Vitest 18 suites / 112 tests 100% PASS, dan *E2E test* via Playwright & gstack browser QA).

### 🚀 Fase Deployment, Operasional & Keamanan
7. 📄 **[07-Deployment_Guide.md](./07-Deployment_Guide.md)**: Strategi peluncuran (Vercel, Docker Compose, Self-Hosted Enterprise), **CI/CD GitHub Actions**, daftar lengkap *Environment Variables*, dan *Database Migration*.
8. 📄 **[08-Operations_and_Runbook.md](./08-Operations_and_Runbook.md)**: Pedoman *Troubleshooting* untuk PostgreSQL multi-tenant, Redis Edge cache, Cloudflare R2, Webhook DLQ, dan templat insiden.
9. 📄 **[09-Security_Policy.md](./09-Security_Policy.md)**: Arsitektur RBAC, RSA License validation, API Token SHA-256 hashing, SQL Injection prevention, *Rate Limiting*, *Security Headers*, dan isolasi data tenant.

### 📦 Pemeliharaan & Pengguna Akhir
10. 📄 **[10-Release_Notes.md](./10-Release_Notes.md)**: Changelog versi (v1.0.0 → v1.2.0 → v1.2.1.0) berdasarkan *Semantic Versioning*.
11. 📄 **[11-User_Manual_and_Integrations.md](./11-User_Manual_and_Integrations.md)**: Panduan pengguna (*end-user*), pengaturan skema dinamis (*Content Types*), dan rincian alur pembayaran Midtrans.

### 🤖 Fitur Lanjutan & Enterprise
12. 📄 **[12-AI_Integration.md](./12-AI_Integration.md)**: Panduan AI Content Generation, AI Schema Engine, Domain Knowledge Blueprints, Model Context Protocol (MCP), dan Starter Project Exporter.
13. 📄 **[13-White_Label_and_Custom_Domain.md](./13-White_Label_and_Custom_Domain.md)**: Panduan White-Label branding dan Custom Domain routing — konfigurasi DNS, cara kerja proxy middleware, dan plan limits.
14. 📄 **[14-Content_Workflow_and_Approval.md](./14-Content_Workflow_and_Approval.md)**: Sumber kebenaran status konten, transisi, role, review berurutan, scheduling, validasi, webhook, dan cache invalidation.
15. 📄 **[15-Implementation_Traceability.md](./15-Implementation_Traceability.md)**: Matriks fitur lengkap yang sudah aktif, batasannya, sumber implementasi kode, dan prosedur sinkronisasi docs-kode.

---

## 🎯 Dokumen Strategis & Desain Tambahan
- 📄 **[sacms-agency-wedge.md](./designs/sacms-agency-wedge.md)**: Dokumen strategi posisi pasar B2B Web Agency Accelerator & hasil automated engineering review.
- 📄 **[sacms-eng-review-test-plan.md](./designs/sacms-eng-review-test-plan.md)**: Rencana pengujian dan cakupan halaman dashboard untuk browser QA otomatis.
