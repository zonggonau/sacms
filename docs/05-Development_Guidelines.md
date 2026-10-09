# SaCMS Development Guidelines

**Baseline:** 23 Agustus 2026 (v1.2.1.0)  
**Tujuan:** Menjaga konsistensi arsitektur kode, keamanan multi-tenant, type safety, dan performa tinggi di seluruh stack Next.js 16.

---

## 1. Naming Conventions

| Elemen | Konvensi | Contoh |
|---|---|---|
| File Komponen / Page | `kebab-case.tsx` | `reviewer-assignment.tsx`, `page.tsx` |
| Utility / Module Lib | `kebab-case.ts` | `content-workflow.ts`, `schema-engine.ts` |
| Server Action | `kebab-case.ts` | `src/actions/content.ts`, `src/actions/mcp-tokens.ts` |
| Komponen React & Type | `PascalCase` | `ContentEntriesManager`, `SchemaField` |
| Fungsi & Variabel | `camelCase` | `getTenantDb`, `validateFieldData` |
| Konstanta Global | `UPPER_SNAKE_CASE` | `CONTENT_STATUSES`, `DEFAULT_LIMITS` |
| Model Prisma | `SingularPascalCase` | `ContentEntry`, `TenantMember`, `ApiKey` |
| Permission Key | `dotted.lowercase` | `content.publish`, `schema.create` |
| Status Workflow Enum | `UPPERCASE` | `DRAFT`, `IN_REVIEW`, `APPROVED`, `PUBLISHED` |

---

## 2. Batasan Arsitektur Modul (Next.js 16 App Router)

1. **Server Components by Default:** Semua `page.tsx` dan `layout.tsx` adalah Server Components. Data di-fetch langsung di server tanpa network waterfall.
2. **Client Components di Leaf Nodes:** Gunakan directive `"use client"` hanya pada komponen interaktif formulir, builder visual, dialog modal, atau komponen yang membutuhkan browser hooks (`useState`, `useEffect`).
3. **Isolasi Server Actions:** Seluruh fungsi mutasi internal dashboard wajib diletakkan di `src/actions/` dengan directive `"use server"`.
4. **Isolasi Database:** Dilarang mengimpor `src/lib/database.ts` atau Prisma client ke dalam Client Component.
5. **No Direct JSON.parse on Prisma Json:** Kolom JSONB Prisma sudah otomatis di-deserialize menjadi JavaScript object. Gunakan tipe `data as Record<string, unknown>`.

---

## 3. Urutan Wajib Eksekusi Mutasi Data (Server Actions & Routes)

Setiap mutasi data tenant wajib menjalankan tahapan berurutan berikut:
1. **Autentikasi Session:** Verifikasi session NextAuth atau validitas API token.
2. **Resolusi Tenant Access:** Validasi keanggotaan user pada tenant (`getTenantAccess`).
3. **Pemeriksaan RBAC & Plan Limits:** Cek izin role (`canRoleTransition`) dan batas kuota paket (`plan-enforcement.ts`).
4. **Validasi Payload Dinamis:** Validasi input menggunakan schema Zod v4 (`content-validations.ts`).
5. **Eksekusi Sync Hooks:** Jalankan webhook sinkron (`content.beforeCreate` / `beforeUpdate`). Jika hook mengembalikan `allowed: false`, batalkan transaksi.
6. **Eksekusi Database Transaction:** Jalankan query menggunakan client tenant (`getTenantDb(tenantId)`).
7. **Pencatatan Version & Audit Log:** Simpan snapshot histori ke `ContentVersion` dan log aksi ke `AuditLog`.
8. **Invalidasi Cache & Webhook Asinkron:** Hapus cache Redis (`public_api:tenant:*`) dan trigger webhook asinkron ke antrean worker.

---

## 4. Pola Query Multi-Tenant yang Aman

### ✅ Pola Aman (Selalu sertakan `tenantId`):
```ts
const tenantDb = await getTenantDb(tenantId)

const entry = await tenantDb.contentEntry.findFirst({
  where: {
    id: entryId,
    tenantId: tenantId,
    contentTypeId: contentTypeId,
  },
})
```

### ❌ Pola Berbahaya (Dilarang):
```ts
// JANGAN gunakan findUnique hanya dengan id tanpa tenantId
const entry = await tenantDb.contentEntry.findUnique({
  where: { id: entryId }
})
```

---

## 5. Standar Testing & Verifikasi

- **Unit & Integration Testing (Vitest):** Wajib lulus 100% sebelum commit (`bun run test`). Semua mock database wajib mensimulasikan Prisma client secara akurat.
- **Type Checking (TypeScript):** `tsc --noEmit` wajib menghasilkan 0 error (`bun run typecheck`).
- **Linter (ESLint):** Bersih tanpa error (`bun run lint`).
- **Automated Route & QA Audit:** Jalankan `bun run qa` atau `bun run cli qa:audit` untuk verifikasi live status route dan latensi.
- **Browser QA (gstack browse):** Halaman publik dan dashboard wajib diverifikasi terhadap responsive layout dan 0 console error sebelum rilis.

---

## 6. Standar Skrip Operasional & Developer CLI (`scripts/`)

Semua skrip otomasi wajib diletakkan di direktori terstruktur [`scripts/`](../scripts/README.md) dan dapat diakses melalui CLI terpadu:
- **Central Runner:** `bun run cli <command>` (contoh: `bun run cli seed:global`, `bun run cli migrate:tenant <slug>`).
- **Core Runtime (`scripts/core/`):** Cron workers, build helpers, healthcheck, dan rotasi secret.
- **Seeds (`scripts/seed/`):** Skrip inisialisasi skema, RBAC permissions, paket, dan template.
- **Migrations (`scripts/migrate/`):** Skrip DDL, dedicated DB push, media migration, dan backfill.
- **QA & Testing (`scripts/qa/`):** Endpoint audit, security smoke test, dan SDK generator.
- **Shell (`scripts/shell/`):** Backup/restore database dan VPS deployment scripts.
- **Rule:** Selalu gunakan Bun runtime (`bun`, `bunx`) dan import path alias `@/lib/database` alih-alih import relatif rapuh.

---

## 7. Git Workflow & Conventional Commits

Gunakan format commit standar:
- `feat(scope): ...` untuk penambahan fitur baru.
- `fix(scope): ...` untuk perbaikan bug atau error.
- `refactor(scope): ...` untuk restrukturisasi kode tanpa mengubah fungsionalitas.
- `chore(release): ...` untuk bump versi, changelog, dan pembaruan dependensi.
