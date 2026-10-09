# SaCMS Testing Plan & Quality Assurance

**Baseline:** v1.3.0  
**Status Pengujian:** 100% PASS (41 test files, 307 tests) & Automated Route QA Score 100%.

---

## 1. Strategi Pengujian Multi-Layer

SaCMS menerapkan pendekatan piramida pengujian multi-layer untuk menjamin stabilitas isolasi multi-tenant, akurasi validasi skema, dan performa tinggi:

```
                  ┌──────────────────────┐
                  │    E2E Browser QA    │  gstack browse & Playwright
                  │ (Responsive & Flows) │  (Score: 99/100)
                  ├──────────────────────┤
                  │ Automated Route QA   │  scripts/qa/qa-runner.ts
                  │ & Security Smoke     │  (Endpoint latency & auth gates)
                  ├──────────────────────┤
                  │  Integration Tests   │  API Handlers, Cache Invalidation,
                  │  (Public & Tenant)   │  Auth, Subdomain Edge & Webhooks
                  ├──────────────────────┤
                  │      Unit Tests      │  Vitest (41 Files, 307 Tests)
                  │ (Workflow, RBAC, DB) │  100% PASS
                  └──────────────────────┘
```

---

## 2. Matriks Pengujian Unit & Integrasi (Vitest)

Menjalankan perintah: `bun run test` atau `vitest run`.

| Modul Pengujian | Jumlah Test | Fokus & Kasus Uji | Status |
|---|---|---|---|
| `__tests__/sdk/client.test.ts` | 17 | TypeScript SDK client, filter builder, query generation | 🟢 PASS |
| `__tests__/proxy/subdomain-routing.test.ts` | 19 | Multi-subdomain edge proxy routing (`api`, `cms`, `admin`, tenant) | 🟢 PASS |
| `__tests__/lib/filters.test.ts` | 14 | Strapi-style operators ($eq, $contains, $in, $or groups, regex-safe) | 🟢 PASS |
| `__tests__/lib/domain-dns.test.ts` | 13 | Apex A-Record, subdomain CNAME, TXT verification DNS resolver | 🟢 PASS |
| `__tests__/lib/content-workflow.test.ts` | 12 | State machine transitions, role permissions, approval matrix | 🟢 PASS |
| `__tests__/lib/content-entry-service.test.ts` | 10 | Content entry lifecycle, JSON data normalization, versioning | 🟢 PASS |
| `__tests__/lib/v0-client.test.ts` | 10 | AI website builder streaming transport & iteration | 🟢 PASS |
| `__tests__/lib/permissions-engine.test.ts` | 9 | Evaluasi permission RBAC dinamis dan custom role | 🟢 PASS |
| `__tests__/lib/rbac-staff.test.ts` | 9 | Hak akses tim editorial, ownership checks, author isolation | 🟢 PASS |
| `__tests__/api/public-content.test.ts` | 9 | Public REST endpoint, SHA-256 token mock, Redis caching | 🟢 PASS |
| `__tests__/lib/storage-quota.test.ts` | 9 | Quota metering, Cloudflare R2 / MinIO usage, BYOS bypass | 🟢 PASS |
| `__tests__/lib/validations.test.ts` | 8 | Zod schema dynamic fields validation | 🟢 PASS |
| `__tests__/lib/select-options.test.ts` | 8 | Select & dropdown field options formatting | 🟢 PASS |
| `__tests__/actions/content.test.ts` | 7 | Server Actions content CRUD, draft saving, tenant scoping | 🟢 PASS |
| `__tests__/lib/safe-url.test.ts` | 7 | Sanitasi URL & proteksi open redirect | 🟢 PASS |
| `__tests__/lib/account-ai-credits.test.ts` | 6 | AI quota ledger & token deduction calculations | 🟢 PASS |
| `__tests__/lib/vercel-registrar.test.ts` | 6 | Domain availability check & sandbox purchase simulator | 🟢 PASS |
| `__tests__/lib/platform-storage.test.ts` | 5 | R2/S3 object storage upload pipeline & thumbnailing | 🟢 PASS |
| `__tests__/api/cron-publish.test.ts` | 4 | Scheduled content publishing lifecycle | 🟢 PASS |
| `__tests__/lib/rate-limit.test.ts` | 4 | Redis pipeline rate limiter & in-memory fallback | 🟢 PASS |
| `__tests__/api/public-content-single.test.ts` | 4 | Single Types read, update, and locale fallback | 🟢 PASS |
| `__tests__/lib/content-validations.test.ts` | 4 | Field type checks (text, number, date, richText) | 🟢 PASS |
| `__tests__/lib/mail.test.ts` | 3 | Nodemailer SMTP transporter & email templates | 🟢 PASS |
| `__tests__/lib/docx-template-parser.test.ts` | 3 | Template docx placeholder parser & generator | 🟢 PASS |
| `__tests__/api/admin-rbac.test.ts` | 2 | Super Admin RBAC permissions enforcement | 🟢 PASS |
| `__tests__/lib/single-type-dedup.test.ts` | 2 | Single Type assignment deduplication | 🟢 PASS |
| `__tests__/api/white-label-domain.test.ts` | 2 | White-label branding API & domain settings | 🟢 PASS |
| `__tests__/actions/tenant-create.test.ts` | 1 | Tenant creation lifecycle & default role assignment | 🟢 PASS |
| **TOTAL KESELURUHAN** | **307 Tests** | **41 Test Files** | **100% PASS** |

---

## 3. Automated Route & Security QA Audit (`scripts/qa/`)

SaCMS menyertakan mesin audit otomatis bawaan untuk mengevaluasi kesehatan endpoint dan celah keamanan secara live:

### 3.1. Route-by-Route QA Auditor (`bun run qa` / `bun run cli qa:audit`)
Script [`scripts/qa/qa-runner.ts`](../scripts/qa/qa-runner.ts) menguji seluruh rute aplikasi secara real-time:
- **Public & Documentation:** `/`, `/docs`, `/docs/mcp`, `/blog`
- **Auth Gates:** `/auth/login`, `/auth/register`, `/auth/forgot-password`
- **Super Admin Panel:** `/admin`, `/admin/infrastructure`, `/admin/users`, `/admin/rbac`, `/admin/databases`, `/admin/domains`, `/admin/webhooks`
- **Developer Hub (Tenant):** `/developer/[tenant]`, `/developer/[tenant]/content-types`, `/developer/[tenant]/content-type-builder`, `/developer/[tenant]/infrastructure`, `/developer/[tenant]/subscriptions`, `/developer/[tenant]/tools/api-keys`
- **CMS Studio:** `/cms/[tenant]`, `/cms/[tenant]/media`
- **APIs:** `/api/health`, `/api/geoip`, `/api/admin/infrastructure`, `/api/public/[tenant]/brand`
- **Metrik:** Mengukur status HTTP, redirect auth gate, dan waktu respons (ms).

```bash
# Menjalankan QA audit pada localhost
bun run qa

# Menjalankan QA audit pada staging/production server
bun run cli qa:audit https://staging.sacms.cloud
```

### 3.2. Security Smoke Testing (`bun run cli qa:security`)
Script [`scripts/qa/qa-security-smoke.ts`](../scripts/qa/qa-security-smoke.ts) memvalidasi proteksi celah keamanan:
- **P0-2 SSRF Prevention:** Image proxy memblokir permintaan ke cloud metadata (`169.254.169.254`).
- **P0-3 Path Traversal:** Endpoint `/api/media/serve` menolak request key dengan traversal `../../etc/passwd`.
- **P0-5 License Activation Auth Gate:** Endpoint `/api/tenant/[tenant]/license/activate` wajib berotentikasi.
- **P0-6 Webhook HMAC Signature:** Webhook eksternal menolak payload tanpa tanda tangan digital.
- **P1 Host-Header Injection:** Verifikasi link tetap pada platform host resmi.
- **P1 API Plaintext Bypass:** Token autentikasi tidak dapat dibypass.

```bash
bun run cli qa:security
```

---

## 4. Pengujian Browser QA Otomatis (gstack browse)

Pengujian visual dan interaksi langsung pada browser headless Chromium (`http://localhost:3000`):

- **Health Score:** 99 / 100
- **Console Errors:** 0
- **Cakupan Viewport:**
  - Mobile (375px × 667px)
  - Tablet (768px × 1024px)
  - Desktop (1280px × 800px)
- **Halaman yang Diverifikasi:**
  - Landing Page (`/`): Animasi hero, CTA button, logo marquee, dark mode responsive.
  - Autentikasi (`/auth/login`, `/auth/register`): Input validation, focus states, password visibility toggle.
  - Dokumentasi (`/docs`, `/blog`): MDX rendering, typography, interactive code blocks.

---

## 5. Prosedur CI/CD Verification Gate

Sebelum kode di-merge ke branch `master`, alur GitHub Actions secara otomatis memvalidasi:
1. `bun run typecheck` (`tsc --noEmit`) → 0 compile errors.
2. `bun run test` (`vitest run`) → 307/307 tests pass (100%).
3. `bun run lint` → Clean lint status.
