# SaCMS Testing Plan & Quality Assurance

**Baseline:** 23 Agustus 2026 (v1.2.1.0)  
**Status Pengujian:** 100% PASS (18 test files, 112 unit tests) & Browser QA Health Score 99/100.

---

## 1. Strategi Pengujian Multi-Layer

SaCMS menerapkan pendekatan piramida pengujian untuk menjamin stabilitas isolasi multi-tenant, akurasi validasi skema, dan performa tinggi:

```
                  ┌──────────────────────┐
                  │    E2E Browser QA    │  gstack browse & Playwright
                  │ (Responsive & Flows) │  (Score: 99/100)
                  ├──────────────────────┤
                  │  Integration Tests   │  API Handlers, Cache Invalidation,
                  │  (Public & Tenant)   │  Auth & Webhooks
                  ├──────────────────────┤
                  │      Unit Tests      │  Vitest (18 Files, 112 Tests)
                  │ (Workflow, RBAC, DB) │  100% PASS
                  └──────────────────────┘
```

---

## 2. Matriks Pengujian Unit (Vitest)

Menjalankan perintah: `npm test` atau `npx vitest run`.

| File Pengujian | Jumlah Test | Fokus & Kasus Uji | Status |
|---|---|---|---|
| `__tests__/sdk/client.test.ts` | 16 | TypeScript SDK client, filter builder, query generation | 🟢 PASS |
| `__tests__/lib/filters.test.ts` | 11 | Strapi-style operators ($eq, $contains, $in, $or groups) | 🟢 PASS |
| `__tests__/lib/content-workflow.test.ts` | 12 | State machine transitions, role permissions, approval matrix | 🟢 PASS |
| `__tests__/lib/validations.test.ts` | 8 | Zod schema dynamic fields validation | 🟢 PASS |
| `__tests__/api/public-content.test.ts` | 8 | Public REST endpoint, SHA-256 token mock, Redis caching | 🟢 PASS |
| `__tests__/actions/content.test.ts` | 7 | Server Actions content CRUD, draft saving, tenant scoping | 🟢 PASS |
| `__tests__/lib/geoip.test.ts` | 7 | Public IP geolocation resolver & country flag generation | 🟢 PASS |
| `__tests__/api/auth.test.ts` | 6 | NextAuth credentials verification, password hashing | 🟢 PASS |
| `__tests__/lib/validate.test.ts` | 6 | Payload sanitization & input boundary validation | 🟢 PASS |
| `__tests__/lib/account-ai-credits.test.ts` | 6 | AI quota ledger & token deduction calculations | 🟢 PASS |
| `__tests__/lib/webhooks.test.ts` | 4 | Synchronous before-hooks & async DLQ delivery | 🟢 PASS |
| `__tests__/api/cron-publish.test.ts` | 4 | Scheduled content publishing lifecycle | 🟢 PASS |
| `__tests__/lib/rate-limit.test.ts` | 4 | Redis pipeline rate limiter & in-memory fallback | 🟢 PASS |
| `__tests__/api/public-content-single.test.ts` | 4 | Single Types read, update, and locale fallback | 🟢 PASS |
| `__tests__/lib/content-validations.test.ts` | 4 | Field type checks (text, number, date, richText) | 🟢 PASS |
| `__tests__/api/admin-rbac.test.ts` | 2 | Super Admin RBAC permissions enforcement | 🟢 PASS |
| `__tests__/lib/single-type-dedup.test.ts` | 2 | Single Type assignment deduplication | 🟢 PASS |
| `__tests__/actions/tenant-create.test.ts` | 1 | Tenant creation lifecycle & default role assignment | 🟢 PASS |
| **TOTAL** | **112 Tests** | **18 Test Files** | **100% PASS** |

---

## 3. Pengujian Browser QA Otomatis (gstack browse)

Pengujian visual dan interaksi langsung pada browser headless Chromium (`http://localhost:3000`):

- **Health Score:** 99 / 100
- **Console Errors:** 0
- **Cakupan Viewport:**
  - Mobile (375px × 667px)
  - Tablet (768px × 1024px)
  - Desktop (1280px × 800px)
- **Halaman yang Diverifikasi:**
  - Landing Page (`/`): Animasi hero, CTA button, logo marquee, dark mode responsive.
  - Autentikasi (`/login`, `/register`): Input validation, focus states, password visibility toggle.
  - Dokumentasi (`/docs`, `/blog`): MDX rendering, typography, interactive code blocks.

---

## 4. Prosedur CI/CD Verification Gate

Sebelum kode di-merge ke branch `master`, alur GitHub Actions secara otomatis memvalidasi:
1. `npm run typecheck` (`tsc --noEmit`) → 0 compile errors.
2. `npm test` (`vitest run`) → 112/112 tests pass.
3. `npm run lint` → Clean lint status.
