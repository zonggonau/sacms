# Security & Compliance Policy

**Baseline:** 19 June 2026  
**Scope note:** This policy separates implemented controls from operational recommendations. Static synchronization did not constitute a penetration test or compliance certification.

Dokumen ini memuat standar kebijakan keamanan (Security Policy) yang diimplementasikan di SaCMS.

## 1. Autentikasi & Otorisasi

- **Passwords:** Disimpan menggunakan algoritma hashing `bcrypt` dengan 12 Salt Rounds. Password asli tidak pernah disentuh atau di-log.
- **Sessions:** Menggunakan JSON Web Tokens (JWT) yang dienkripsi secara native oleh `NextAuth`. Cookie bersifat `HttpOnly`, `Secure` (di production), dan memiliki atribut `SameSite=Lax` untuk mencegah CSRF.
- **Isolasi Data (Multi-Tenant):** Skema `[tenantId, documentId]` bersifat absolut. Semua akses ORM dibungkus oleh fungsi factory `getTenantDb()` untuk mencegah *Cross-Tenant Data Leakage*.

## 2. Manajemen API Keys

- API Tokens dibuat dengan prefiks standar (contoh `cf_`).
- Hash dari token (di-hash menggunakan `SHA-256` untuk pencarian O(1) yang cepat) disimpan ke dalam database. Sistem akan menampilkan token asli hanya SATU KALI saat pembuatan.
- Hash tersimpan tidak dikembalikan oleh list/detail/create metadata dan tidak diinjeksikan otomatis ke GraphQL Explorer.
- **Rotasi Key:** Direkomendasikan bagi Tenant Admin untuk merotasi kunci publik minimal setiap 6 bulan.
- **Jenis Token:**
  - `read-only`: Hanya bisa membaca konten yang berstatus PUBLISHED.
  - `full-access`: Dapat melakukan mutasi (create, update, delete) via REST dan GraphQL.

## 3. Rate Limiting & Proteksi Serangan

Sistem dilindungi dari serangan *Brute Force* dan *DDoS L7* menggunakan Upstash Redis:
- **Public API Proxy:** 1.000 requests per menit per IP according to `RATE_LIMITS.publicApi`.
- **Public API Route:** 1.000 requests per menit per authenticated token hash, in addition to the proxy limit.
- **Authentication Endpoints:** 30 attempts per minute per IP.
- **Tenant Management API:** 300 requests per minute per IP.
- **File Upload:** Dibatasi ukuran file maksimal per request untuk menghindari *Denial of Service* pada penyimpanan R2.
- **Fallback:** Jika Upstash Redis tidak tersedia, sistem secara otomatis menggunakan *in-memory rate limiter* sebagai fallback (lihat `lib/rate-limit.ts`).

## 4. RBAC (Role-Based Access Control)

SaCMS mengimplementasikan RBAC dua lapis:

### 4.1. System Roles (Built-in)
| Role | Deskripsi |
|------|-----------|
| `super_admin` | Akses penuh ke seluruh sistem, termasuk semua tenant |
| `owner` | Pemilik workspace, akses penuh ke tenant |
| `admin` | Admin workspace, dapat mengelola member dan konten |
| `editor` | Dapat membuat/mengedit konten dan transisi yang diizinkan; delete tetap owner/admin |
| `member` | Kontributor dasar, umumnya Draft dan submit review |
| `viewer` | Read-only, hanya bisa melihat konten |

### 4.2. Content Workflow Transitions
Transisi status konten dikontrol ketat oleh `lib/content-workflow.ts`:
```
DRAFT → IN_REVIEW  (Editor)
DRAFT → PUBLISHED | SCHEDULED  (Admin/Owner)
IN_REVIEW → APPROVED | REJECTED  (Admin/Owner)
APPROVED → PUBLISHED | SCHEDULED  (Admin/Owner)
PUBLISHED → ARCHIVED  (Admin/Owner)
```

Reviewer yang di-assign dapat memberi keputusan berurutan melalui `ContentReviewAssignment`. Matriks lengkap berada di dokumen 14.

### 4.3. Custom RBAC
Tenant dapat menggunakan *custom roles* dan granular permission melalui endpoint role/RBAC. Batas plan untuk custom role harus mengikuti enforcement yang benar-benar diterapkan pada route, bukan diasumsikan dari UI.

## 5. Keamanan Proxy

File `src/proxy.ts` (Next.js Middleware) menyuntikkan *Security Headers* pada setiap HTTP Response:
- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` (HSTS)
- `X-Frame-Options: DENY` (mencegah Clickjacking)
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- Content Security Policy sebagaimana didefinisikan di `src/proxy.ts`.

Middleware juga menangani:
- **Custom Domain Routing:** Request ke custom domain (`*.client.com`) secara otomatis di-proxy ke tenant yang terdaftar.
- **CORS:** Endpoint Public API saat ini menggunakan `Access-Control-Allow-Origin: *`. Ini bukan origin allowlist; keamanan utama tetap Bearer token dan tenant binding.

## 6. Validasi Input

- Route Handler dan Server Action baru **harus** menggunakan Zod atau validator eksplisit. Sebagian route historis masih melakukan validasi manual dan harus dimigrasikan bertahap.
- Validasi harus dilakukan *sebelum* query mutasi database dieksekusi.
- File upload divalidasi berdasarkan MIME type dan ukuran sebelum diteruskan ke R2.

## 7. SQL Injection Prevention

- SaCMS menggunakan raw SQL pada jalur filter/search/sort JSONB tertentu dan Full-Text Search.
- Semua query menggunakan **Prisma ORM** dengan parameterized values.
- Filter engine (`lib/filters.ts`) mengizinkan field/operator yang dikenal dan mem-parameterize nilai input. Nama sort/field wajib berasal dari allowlist schema/system.

## 8. White-Label & Custom Domain Security

- Custom domain harus diverifikasi kepemilikannya sebelum aktif (via DNS TXT record).
- DNS verification disimpan di database; request-time proxy memakai mapping Redis `domain:{host}`. Tidak ada fallback database pada proxy saat ini.
- Tenant tidak dapat mengklaim domain yang sudah digunakan tenant lain.

## 9. Audit Logging (Kepatuhan / Compliance)

Sebagai syarat SaaS Enterprise, semua tindakan *Destructive* (seperti penghapusan akun, perubahan skema database, atau rilis konten) direkam dalam tabel `AuditLog` beserta timestamp dan detail *actor*.

- **Retensi log** bergantung pada plan: Free (0 hari), Starter (7 hari), Pro (30 hari), Enterprise (365 hari).
- Log dapat dibaca via `/api/tenant/[tenant]/audit-logs`. Retensi otomatis/purge harus dioperasikan secara terpisah jika belum dijadwalkan.

## 10. Public API cache invariants

- Token, tenant, expiry, dan status harus tervalidasi sebelum cache dibaca.
- Cache key memasukkan ID token agar tampilan full-access dan read-only tidak berbagi response tanpa sengaja.
- Raw token tidak digunakan sebagai cache key atau Redis rate-limit key.
- Populated relation untuk read-only token dibatasi ke tenant yang sama dan status `PUBLISHED`.

## 11. Tenant isolation checklist

Setiap jalur yang menerima ID dari client wajib memastikan:

1. Session/token valid.
2. Tenant route cocok dengan membership/token.
3. Query resource menyertakan `tenantId` atau relasi tenant yang ekuivalen.
4. Resource global harus memiliki assignment aktif bila assignment diwajibkan.
5. Dedicated DB tetap memakai filter tenant untuk keamanan saat fallback ke shared DB.
6. Child ID seperti reviewer, media, webhook, dan role tidak dipercaya tanpa parent tenant.

