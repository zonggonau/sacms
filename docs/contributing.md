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
