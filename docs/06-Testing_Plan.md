# Testing Plan & QA Guide

Dokumen ini menetapkan standar pengujian perangkat lunak (Testing) untuk menjaga stabilitas SaCMS.

> **Current review note (19 June 2026):** No test, build, lint, coverage, E2E, migration, or external integration verification was run during the documentation/workflow synchronization. This file defines the future verification procedure; it does not claim the current branch passed it.

## 1. Lapisan Pengujian (Testing Layers)

Sistem ini diuji pada 3 lapisan berbeda:
1. **Unit Testing:** Menguji komponen fungsi logika (Filter parsing, Role Check, Webhook Trigger).
2. **Integration Testing:** Menguji komunikasi Next.js API Routes dengan database lokal (Prisma + PostgreSQL lokal).
3. **End-to-End (E2E) Testing:** Menguji antarmuka pengguna dashboard (Next.js Server Components) di browser.

## 2. Tools yang Digunakan
- **Unit & Integration:** [Vitest](https://vitest.dev/) (karena lebih cepat dan kompatibel secara native dengan TypeScript/ESM).
- **E2E Testing:** [Playwright](https://playwright.dev/) (menyediakan kontrol browser yang lebih baik daripada Cypress untuk multi-tab testing, sangat berguna untuk mengetes real-time Webhook).

## 3. Menjalankan Tes

### 3.1. Unit & Integration Test
Pastikan Anda memiliki file `.env.test` yang mengarah ke database khusus *testing*.
```bash
# Menjalankan seluruh test
npm run test

# Menjalankan test dalam mode watch (saat development)
npm run test:watch
```
**Cakupan (Coverage) Target:** Minimal 70% untuk core libraries (`lib/filters.ts`, `lib/content-workflow.ts`).

### 3.2. E2E Test (Playwright)
```bash
# Install browser binaries
npx playwright install

# Jalankan E2E
npx playwright test

# Lihat laporan hasil E2E
npx playwright show-report
```

## 4. Standar Penulisan Tes
- Nama file unit test menggunakan akhiran `.test.ts` (contoh: `filters.test.ts`).
- Jangan mencantumkan jumlah test “berjalan sukses” tanpa menyimpan hasil command, tanggal, commit, dan environment yang digunakan.
- Folder E2E test berada di root `/e2e`. Playwright dikonfigurasi secara spesifik melalui file `e2e/global-setup.ts` untuk:
  - Membuat mocked user session.
  - Memasukkan Tenant Test secara otomatis ke dalam Plan `enterprise` untuk meniadakan limit resource selama E2E tests berjalan (menghindari error "Plan Limit Exceeded" saat membuat Content Type).
  - Menyediakan *hashed API Token* bawaan untuk pengetesan autentikasi Public API.
- Dilarang keras menjalankan Integration/E2E test ke database `Production`. Semua proses CI/CD harus menjalankan Docker container dengan database *ephemeral*.

## 5. Authorization gate

Verification is a separate phase from feature/workflow refinement. Before running commands, confirm scope with the project owner:

- Static review only.
- Targeted unit test.
- Typecheck/lint.
- Build.
- Integration/E2E with an isolated database.
- External-provider sandbox verification.

If the owner requests no test/build activity, limit work to code/document inspection and record that verification remains pending, as done in document 15.
