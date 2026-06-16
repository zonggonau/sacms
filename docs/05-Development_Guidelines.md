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
* **Server Actions + Zod + React Hook Form:**
  Untuk mutasi data dari UI (*Forms*), wajib menggunakan pola ini:
  1. Definisikan skema Zod di `src/types/schemas.ts`.
  2. Gunakan `useForm({ resolver: zodResolver(schema) })` pada komponen form.
  3. Lempar data yang tervalidasi di client ke Server Action.
  4. Di Server Action, validasi ULANG menggunakan `schema.parse(data)` sebelum menyentuh Prisma.
* **Error Handling Standard:**
  Gunakan blok `try/catch` di dalam Route Handlers dan Server Actions. Lempar pesan kesalahan ke UI menggunakan pola seragam: `return { error: "Pesan error spesifik", success: false }`.
* **Multi-Tenant Safety Check:** Jangan pernah melakukan *query* database untuk data sensitif tanpa menyertakan abstraksi `getTenantDb(tenantId)`.

## 4. Git Workflow & Contribution Guide

Kami menggunakan variasi sederhana dari **Git Flow** yang disederhanakan dan berorientasi pada CI/CD:

### Branch Strategy
* `master`: Cabang produksi yang selalu stabil (*Production-ready*).
* `develop`: Cabang utama untuk integrasi (*Staging/Development*). 
* `feature/[nama-fitur]`: Untuk fitur baru. Di-branch dari `develop` dan di-merge kembali ke `develop` via Pull Request (contoh: `feature/webhook-dlq`).
* `bugfix/[nama-bug]` atau `hotfix/*`: Untuk perbaikan *bug*. Di-branch dari `develop` (untuk bug biasa) atau `master` (untuk darurat), lalu di-merge kembali ke `master` serta `develop`.

### Commit Convention
Gunakan standar [Conventional Commits](https://www.conventionalcommits.org/):
* `feat:` (fitur baru)
* `fix:` (perbaikan bug)
* `docs:` (perubahan dokumentasi)
* `style:` (formatting, missing semi colons, tanpa ubah logika)
* `refactor:` (restrukturisasi kode)
* `test:` (menambah test)
* `chore:` (update dependencies, konfigurasi build)

**Contoh Commit:** `feat(api): add content search filtering via pg_tsvector`

### Proses Pull Request (PR)
1. Push branch `feature/*` Anda ke remote repositori.
2. Buat Pull Request yang mengarah ke branch `develop`.
3. Tulis deskripsi PR secara jelas: apa masalahnya, solusinya, dan lampirkan screenshot jika ada perubahan UI.
4. CI Pipeline (GitHub Actions) wajib berstatus **Passed** (Build sukses & Vitest sukses).

## 5. Standardisasi Kode & Database

### Linting & Formatting
Proyek ini mengutamakan keterbacaan kode (*Code Readability*).
- Gunakan ESLint standar bawaan Next.js (`next lint`).
- Terapkan **Prettier** untuk auto-formatting kode sebelum di-commit.
- Dilarang keras menggunakan tipe `any` pada TypeScript.

### Sinkronisasi Prisma Schema
Jika Anda mengubah file `prisma/schema.prisma`:
1. Buat file migrasi lokal: `npx prisma migrate dev --name deskripsi_perubahan`.
2. Commit file `.sql` migrasi yang ter-generate. Dilarang mengedit file migrasi SQL secara manual tanpa diskusi dengan Lead Engineer.
