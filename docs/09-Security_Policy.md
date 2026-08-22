# SaCMS Security Policy & Architecture

**Baseline:** 23 Agustus 2026 (v1.2.1.0)  
**Tujuan:** Menjamin isolasi data mutlak (Zero-Leakage Multi-Tenancy), integritas lisensi enterprise, keamanan token API, dan perlindungan terhadap kerentanan OWASP Top 10.

---

## 1. Zero-Leakage Multi-Tenant Isolation

### 1.1 Prinsip Isolasi Prisma
Semua query data tenant wajib menyertakan filter `tenantId`:
- Database routing di `src/lib/database.ts` menyelesaikan client tenant melalui `getTenantDb(tenantId)`.
- Jika tenant menggunakan database dedicated, koneksi dikelola melalui cache LRU terisolasi. Jika koneksi dedicated gagal, sistem menerapkan *failover fallback* ke Master DB dengan pelaporan error aman tanpa membocorkan kredensial.
- Dilarang keras melakukan query `findUnique` hanya dengan `id` tanpa predikat `tenantId`.

### 1.2 Isolasi Media (Cloudflare R2)
Aset media disimpan dalam bucket R2 dengan prefix path berbasis tenant:
```
${tenantId}/media/${folderId}/${filename}
```
Akses ke media diproteksi dengan verifikasi kepemilikan tenant sebelum URL signed diterbitkan.

---

## 2. Autentikasi & Proteksi Token

### 2.1 SHA-256 API Token Hashing
- Plaintext token (`cf_live_...`) hanya ditampilkan satu kali saat digenerate.
- Database hanya menyimpan digest hash **SHA-256**.
- Saat request masuk, token di-hash secara instan dan dicocokkan ke database menggunakan query index O(1).

### 2.2 Model Context Protocol (MCP) Token Security
- Token MCP terikat secara eksklusif ke tenant dan dibatasi pada tools yang diizinkan (`read-schema`, `query-content`, `create-draft`).
- AI assistant tidak memiliki izin mengeksekusi aksi administratif platform atau mutasi pengguna.

---

## 3. Sistem Lisensi Enterprise (RSA Asymmetric Signature)

Untuk deployment **Self-Hosted Enterprise**:
- Lisensi di-generate oleh Super Admin menggunakan **RSA Private Key**.
- Server customer memvalidasi `LICENSE_KEY` secara offline menggunakan **RSA Public Key** yang disematkan di dalam source code (`src/lib/license.ts`).
- Lisensi memuat payload terenkripsi: `tenantId`, `features`, `issuedAt`, `expiresAt`, dan `maxWorkspaces`.
- Cache status lisensi disimpan di database lokal (`LicenseCache`) untuk efisiensi verifikasi berulang.

---

## 4. Perlindungan Jaringan & Rate Limiting

### 4.1 Upstash Redis Pipeline Limiter
- Setiap request API publik diperiksa oleh rate limiter atomik (`cf:rl:${identifier}`).
- Rate limit dibedakan berdasarkan tier paket:
  - Free: 60 req/menit
  - Starter: 300 req/menit
  - Pro: 1.200 req/menit
  - Enterprise: 5.000+ req/menit
- Jika Redis tidak tersedia, sistem beralih otomatis ke in-memory sliding window rate limiter.

### 4.2 Security Headers (proxy.ts)
Semua respons HTTP menyertakan security headers modern:
```http
X-Content-Type-Options: nosniff
X-Frame-Options: SAMEORIGIN
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
Content-Security-Policy: default-src 'self'; img-src 'self' data: https: blob:;
```

---

## 5. Keamanan Webhooks (HMAC SHA-256)

Setiap pengiriman webhook asinkron ke URL eksternal menyertakan tanda tangan digital pada header:
```http
X-SaCMS-Signature: sha256=<HMAC_HEX_DIGEST>
X-SaCMS-Event: content.published
X-SaCMS-Delivery: <DELIVERY_UUID>
```
Penerima dapat memverifikasi keaslian payload menggunakan shared secret yang dikonfigurasi di dashboard.
