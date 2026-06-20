# Development Guidelines

**Baseline:** 19 June 2026  
**Objective:** Keep feature behavior, workflow, security, and documentation synchronized.

## 1. Naming

| Element | Convention | Example |
|---|---|---|
| React/Next file | kebab-case or framework filename | `reviewer-assignment.tsx`, `page.tsx` |
| Utility module | kebab-case | `content-workflow-rules.ts` |
| React component/type | PascalCase | `ReviewerAssignment` |
| Function/variable | camelCase | `getTenantAccess` |
| Constant | UPPER_SNAKE_CASE | `CONTENT_STATUSES` |
| Prisma model | Singular PascalCase | `ContentEntry` |
| Route parameter directory | Next dynamic segment | `[tenant]`, `[entryId]` |
| Permission key | dotted lower-case | `content.update` |
| Workflow status | upper-case enum | `IN_REVIEW` |

## 2. Module boundaries

- Put pure, framework-independent rules in `src/lib/*-rules.ts` so server and client can share them safely.
- Put authenticated dashboard mutations in `src/actions/`.
- Put external/session HTTP contracts in `src/app/api/**/route.ts`.
- Keep database/provider code in `src/lib/` adapters.
- Keep interactive UI at the leaves with `"use client"`; pages/layouts remain Server Components unless browser state is required.
- Do not import a database-bearing module into Client Components.

## 3. Mandatory mutation sequence

For tenant-scoped mutations, use this order:

1. Resolve session/token.
2. Resolve tenant access and canonical tenant ID.
3. Check role/RBAC/feature/plan.
4. Validate path/query/body.
5. Resolve the target resource with its tenant predicate.
6. Validate business state and workflow transition.
7. Execute synchronous pre-hooks.
8. Commit the smallest practical transaction.
9. Write version/audit records.
10. Trigger asynchronous webhooks and cache/path invalidation.
11. Return a stable error/success shape.

Never fetch an entry/member/media/webhook by client-provided ID and only later assume it belongs to the current tenant.

## 4. Validation rules

- Prefer Zod schemas close to Route Handler boundaries.
- Reuse validation helpers for Server Actions.
- Validate enum/status values explicitly; avoid unchecked `as any` at persistence boundaries.
- Draft content may defer required fields, but type and uniqueness checks still apply.
- Validate updates against merged existing + submitted data when partial patches are supported.
- Validate date semantics, not only date syntax (`scheduledAt` must be in the future).
- Limit free-form strings and collection sizes to prevent oversized payloads.

## 5. Tenant safety

Safe:

```ts
await tenantDb.contentEntry.findFirst({
  where: { id: entryId, tenantId, contentTypeId },
})
```

Unsafe:

<<<<<<< HEAD
```ts
await tenantDb.contentEntry.findUnique({ where: { id: entryId } })
```

The unsafe form is especially dangerous because `getTenantDb()` may return the shared master client when the tenant has no dedicated database URL.

## 6. Workflow changes

`src/lib/content-workflow-rules.ts` is the canonical state machine. A workflow change must update:

- Pure transition rules and permission key.
- Server Actions and relevant API/GraphQL write paths.
- UI status choices/buttons.
- Permission seed data when adding a permission.
- Cron logic if the scheduler transition changes.
- Documents 02, 04, 09, 14, and 15.

Do not duplicate a second transition matrix in a component.

## 7. Public API and cache

- Authenticate before reading cache.
- Never use plaintext secrets in Redis/cache keys.
- Bind token to tenant before data access.
- Force read-only tokens to published content.
- Scope populated relations to tenant and visibility rules.
- Build dynamic SQL values with parameters; field/operator/sort identifiers require allowlists.
- Invalidate all affected cache namespaces after mutations.

## 8. Error handling

Use predictable HTTP semantics:

- `400`: malformed input.
- `401`: missing/invalid authentication.
- `403`: authenticated but not permitted.
- `404`: resource absent in the authorized scope.
- `409`: lifecycle/uniqueness conflict.
- `429`: request/provider rate limit.
- `500`: unexpected internal failure.
- `503`: optional provider not configured/available.

Avoid returning internal stack traces, raw provider responses, credentials, or database URLs.

## 9. Git workflow

This repository has had multiple historical branch names. Do not hard-code a `main/dev` or `master/develop` assumption in feature documentation. Use the repository's current default/integration branches agreed by the maintainer.

Recommended branch prefixes:

- `feature/…`
- `fix/…`
- `refactor/…`
- `docs/…`
- `hotfix/…`

Use Conventional Commits:

```text
feat(workflow): add sequential review decision endpoint
fix(api): authenticate before public cache lookup
docs(workflow): document scheduled publication invariants
```

## 10. Pull request/change checklist

- Problem and desired behavior are stated.
- Tenant and authorization boundaries are reviewed.
- Plan/feature gating is explicit.
- Workflow transition and side effects are explicit.
- Database/schema changes include a migration strategy.
- API method/path/payload examples match Route Handlers.
- UI exposes only valid operations but server remains authoritative.
- Documentation and traceability matrix are updated.
- Verification activity is run only in its authorized phase and results are recorded honestly.

## 11. Database changes

- Change `prisma/schema.prisma` first.
- Generate a named migration during the authorized database workflow.
- Commit migration SQL and review destructive statements.
- Never use `prisma migrate dev` in production.
- Regenerate the custom Prisma client output when the schema changes.
- Dedicated tenant schemas must be migrated consistently with the master schema where applicable.

## 12. Documentation standard

- Use exact current method names, paths, enum values, and environment variables.
- Mark examples as examples; do not present them as verified production facts.
- Separate “implemented,” “partial,” and “planned.”
- Avoid exact test counts or performance claims unless the result/date/environment is recorded.
- Update release notes after code exists, not before.
- Add a constraint section when a feature relies on Redis, R2, DNS, cron, or another external service.

=======
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
>>>>>>> 9b50af6e8ed16d25ac05384876bc74c76e7d32c0
