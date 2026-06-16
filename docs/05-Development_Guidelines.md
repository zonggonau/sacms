# Coding Standards & Git Workflow

Dokumen ini mendefinisikan standar penulisan kode, konvensi penamaan, dan alur kerja Git (Git Workflow) untuk seluruh tim pengembang yang berkontribusi pada SaCMS.

---

## 1. Naming Convention

| Tipe | Aturan Penamaan | Contoh |
|------|-----------------|--------|
| **File (React/Next.js)** | Kebab-case | `content-type-entries.tsx`, `page.tsx` |
| **File (Utilities)** | Kebab-case | `rate-limit.ts`, `database.ts` |
| **Komponen React** | PascalCase | `Button`, `ContentEditor`, `MediaPicker` |
| **Variabel / Fungsi** | camelCase | `fetchEntries`, `tenantId`, `isPublished` |
| **Konstanta / Enum** | UPPER_SNAKE_CASE | `MAX_UPLOAD_SIZE`, `ContentStatus.PUBLISHED` |
| **Model Database (Prisma)** | PascalCase (Singular) | `model ContentEntry`, `model Tenant` |

## 2. Folder Structure

SaCMS menggunakan arsitektur modular yang sangat memisahkan UI dan Backend via `app` router:

```text
src/
├── actions/         # Server Actions (Mutations untuk Dashboard)
├── app/
│   ├── (public)/    # Halaman landing page & Auth
│   ├── (content)/   # Manajemen konten
│   ├── (system)/    # Pengaturan sistem inti
│   ├── (workspace)/ # Dashboard UI (Panel Admin per Tenant)
│   ├── (billing)/   # Manajemen penagihan & langganan
│   ├── api/         # Route Handlers (Public API, Tenant API, Webhooks)
│   └── cron/        # Endpoint khusus CRON jobs
├── components/      # UI Components (shadcn/ui, atomic design)
├── lib/             # Core Utilities (DB, Redis, R2, Filters)
├── types/           # Global TypeScript interfaces
└── utils/           # Helper functions murni (formatting, dll)
```

## 3. Clean Code Guideline (Next.js 16)

* **Server Components by Default:** Selalu gunakan Server Components kecuali komponen tersebut membutuhkan *interactivity* (seperti `onClick`, `useState`). Gunakan `"use client"` hanya pada ujung komponen (*leaf nodes*).
* **Zod Validation:** **Semua** *Route Handlers* dan *Server Actions* WAJIB memvalidasi *payload* masukan menggunakan Zod sebelum berinteraksi dengan *database*.
* **Multi-Tenant Safety Check:** Jangan pernah melakukan *query* database untuk data sensitif tanpa menyertakan klausa `where: { tenantId }`.

## 4. Git Workflow Document

Kami menggunakan variasi sederhana dari **Git Flow** yang cocok untuk CI/CD.

### Branch Strategy
* `main`: Cabang stabil (*Production-ready*). Deployment ke *production environment* diambil dari *branch* ini.
* `develop`: Cabang utama untuk integrasi (*Staging/Development*). 
* `feature/*`: Untuk fitur baru. Di-branch dari `develop` dan di-merge kembali ke `develop` via Pull Request.
* `hotfix/*`: Untuk perbaikan *bug* mendesak di *production*. Di-branch dari `main` dan di-merge ke `main` serta `develop`.

### Commit Convention
Kami mengikuti [Conventional Commits](https://www.conventionalcommits.org/):
* `feat:` (fitur baru)
* `fix:` (perbaikan bug)
* `docs:` (perubahan dokumentasi)
* `style:` (formatting, missing semi colons, dll; tanpa ubah logika)
* `refactor:` (restrukturisasi kode)
* `test:` (menambah test)
* `chore:` (update dependencies, konfigurasi build)

**Contoh Commit:**
`feat(api): add content search filtering via pg_tsvector`
# Developer Contribution Guide

Panduan bagi para developer (Software Engineer) yang akan berkontribusi menulis kode pada repositori SaCMS.

## 1. Branching Strategy (Git Flow)
Kami menggunakan model percabangan berbasis Git Flow yang disederhanakan:
- `main`: Branch produksi yang selalu siap rilis (*Deployable*).
- `dev`: Branch integrasi pengembangan aktif.
- `feature/[nama-fitur]`: Untuk pembuatan fitur baru (contoh: `feature/webhook-dlq`).
- `bugfix/[nama-bug]`: Untuk perbaikan bug (contoh: `bugfix/redis-timeout`).

## 2. Commit Convention
Gunakan **Conventional Commits**:
- `feat:` Fitur baru.
- `fix:` Perbaikan bug.
- `docs:` Perubahan dokumentasi (PRD, panduan).
- `style:` Formatting, missing semi colons (tidak merubah logika kode).
- `refactor:` Restrukturisasi kode tanpa merubah perilaku.
- `test:` Penambahan atau perbaikan unit test.
- `chore:` Update package/dependencies.

*Contoh:* `feat: add midtrans snap integration for subscription`

## 3. Standardisasi Kode (Linting & Formatting)
Proyek ini mengutamakan keterbacaan kode (Code Readability).
- Gunakan ESLint standar bawaan Next.js (`next lint`).
- Terapkan **Prettier** untuk auto-formatting kode sebelum di-commit.
- Hindari penggunaan tipe `any` pada TypeScript. Selalu definisikan `interface` atau `type`.

## 4. Proses Pull Request (PR)
1. Push branch Anda ke remote repositori.
2. Buat Pull Request yang mengarah ke branch `dev`.
3. Tulis deskripsi PR secara jelas: apa masalahnya, apa solusinya, dan lampirkan screenshot jika terdapat perubahan UI.
4. Minimal 1 *Code Reviewer* harus me-*approve* PR sebelum bisa di-merge.
5. CI Pipeline (GitHub Actions) harus berstatus **Passed** (Build sukses & Vitest sukses).

## 5. Sinkronisasi Database
Jika PR Anda mengandung perubahan pada file `prisma/schema.prisma`:
1. Buat file migrasi lokal: `npx prisma migrate dev --name deskripsi_perubahan`.
2. Commit file `.sql` migrasi yang ter-generate di folder `prisma/migrations`. Dilarang mengedit file migrasi SQL secara manual tanpa diskusi dengan Lead Engineer.
