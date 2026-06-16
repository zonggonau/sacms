# Security & Compliance Policy

Dokumen ini memuat standar kebijakan keamanan (Security Policy) yang diimplementasikan di SaCMS.

## 1. Autentikasi & Otorisasi
- **Passwords:** Disimpan menggunakan algoritma hashing `bcrypt` dengan 12 Salt Rounds. Password asli tidak pernah disentuh atau di-log.
- **Sessions:** Menggunakan JSON Web Tokens (JWT) yang dienkripsi secara native oleh `NextAuth`. Cookie bersifat `HttpOnly`, `Secure` (di production), dan memiliki atribut `SameSite=Lax` untuk mencegah CSRF.
- **Isolasi Data (Multi-Tenant):** Skema `[tenantId, documentId]` bersifat absolut. Semua akses ORM dibungkus oleh fungsi factory `getTenantDb()` untuk mencegah *Cross-Tenant Data Leakage*.

## 2. Manajemen API Keys
- API Tokens dibuat dengan prefiks standar (contoh `cf_`).
- Hash dari token (di-hash menggunakan `SHA-256` untuk pencarian O(1) yang cepat) disimpan ke dalam database. Sistem akan menampilkan token asli hanya SATU KALI saat pembuatan.
- **Rotasi Key:** Direkomendasikan bagi Tenant Admin untuk merotasi kunci publik minimal setiap 6 bulan.

## 3. Rate Limiting & Proteksi Serangan
Sistem dilindungi dari serangan *Brute Force* dan *DDoS L7* menggunakan Upstash Redis:
- **Public API:** Dibatasi maksimal 60 requests per menit per IP.
- **Authentication Endpoints:** Dibatasi maksimal 5 percabangan login per menit.
- **File Upload:** Dibatasi maksimal ukuran file (contoh: 10MB) untuk menghindari *Denial of Service* pada penyimpanan R2 dan bandwidth.

## 4. Keamanan Middleware
File `middleware.ts` Next.js menyuntikkan *Security Headers* pada setiap HTTP Response:
- `X-DNS-Prefetch-Control: on`
- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
- `X-Frame-Options: SAMEORIGIN` (mencegah Clickjacking)
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: origin-when-cross-origin`

## 5. Audit Logging (Kepatuhan / Compliance)
Sebagai syarat SaaS Enterprise, semua tindakan *Destructive* (seperti penghapusan akun, perubahan skema database, atau rilis konten) direkam dalam tabel `AuditLog` beserta timestamp dan detail *actor*.
