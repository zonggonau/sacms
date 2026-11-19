# SaCMS Testing Plan & Quality Assurance

## 1. Strategi Pengujian

Jalankan Vitest untuk unit dan kontrak API, rangkaian integrasi dengan PostgreSQL sementara untuk alur lintas sistem, serta Playwright untuk alur browser. Hasil aktual tercatat di masing-masing eksekusi tes.

## 2. Vitest dan PostgreSQL

```bash
bun run test
bun run --cwd mini-services/sdk test
```

Job `critical-flows` menyiapkan database `sacms_workflow_ci` dan `sacms_dedicated_ci`. Jalankan `bun x vitest run --config vitest.integration.config.ts` setelah skema tersedia dan `DATABASE_URL`, `DIRECT_URL`, `SACMS_DEDICATED_CI_DATABASE_URL`, serta `SACMS_WORKFLOW_CI=1` diatur sebagaimana pada workflow. Uji ini menulis data fixture dan memeriksa alur berikut.

- Publikasi konten terjadwal pada database shared dan dedicated.
- Rollback dan percobaan ulang pemenuhan pembayaran.
- Pencegahan invoice ganda saat dua siklus penagihan berjalan bersamaan.
- Penerapan Website Template pada workspace yang sudah memiliki `site-settings` dan kelanjutan deploy setelah gagal.

[Workflow CI](../.github/workflows/ci.yml) · [Skenario integrasi](../integration/critical-flows.test.ts)

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

## 4. Pengujian browser

Jalankan `bun x playwright test` pada server lokal dengan database uji. Global setup menyiapkan fixture dan menulis sesi ke `e2e/.auth/storageState.json`.

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

Workflow GitHub Actions menjalankan typecheck, lint, suite Vitest, build standalone, dan job integrasi PostgreSQL. Deploy menunggu job build dan integrasi selesai dengan sukses.
