# SaCMS Deployment & Operations Guide

## 1. Persyaratan Sistem (Prerequisites)
Sebelum melakukan deployment, pastikan Anda memiliki:
- Node.js v20.x atau terbaru (atau Bun v1.x).
- PostgreSQL v14+.
- Akun Cloudflare R2 untuk penyimpanan media.
- Akun Upstash Redis (untuk rate limit dan cache).
- Akun Midtrans (untuk payment gateway).
- (Opsional) API Key DeepSeek untuk fitur AI Content Generation.

> Kebutuhan layanan bersifat feature-dependent: aplikasi dapat berjalan tanpa R2, Redis, payment, AI, OAuth, SMTP, atau Sentry, tetapi fitur terkait akan gagal, turun ke fallback terbatas, atau tidak ditampilkan. Production readiness harus dinilai berdasarkan fitur yang diaktifkan.

## 2. Environment Variables Lengkap (`.env`)
Buat file `.env` berdasarkan referensi ini. Semua variabel wajib harus diisi:

```env
# =========================================
# URL & NextAuth (WAJIB)
# =========================================
NEXT_PUBLIC_APP_URL="https://your-domain.com"
NEXTAUTH_URL="https://your-domain.com"
NEXTAUTH_SECRET="random_strong_string_min_32_chars"

# =========================================
# Database (WAJIB)
# =========================================
DATABASE_URL="postgresql://user:pass@host:5432/sacms?schema=public"

# =========================================
# Upstash Redis (WAJIB untuk rate limiting)
# =========================================
UPSTASH_REDIS_REST_URL="https://xxx.upstash.io"
UPSTASH_REDIS_REST_TOKEN="xxxx"

# =========================================
# Cloudflare R2 (WAJIB untuk media upload)
# =========================================
R2_ACCOUNT_ID="xxx"
R2_ACCESS_KEY_ID="xxx"
R2_SECRET_ACCESS_KEY="xxx"
R2_BUCKET_NAME="sacms-media"
R2_PUBLIC_URL="https://media.your-domain.com"

# =========================================
# Midtrans Payment Gateway (WAJIB untuk billing)
# =========================================
MIDTRANS_MODE="production"          # "sandbox" | "production"
MIDTRANS_SERVER_KEY="Mid-server-xxx"
MIDTRANS_CLIENT_KEY="Mid-client-xxx"
NEXT_PUBLIC_MIDTRANS_CLIENT_KEY="Mid-client-xxx"
NEXT_PUBLIC_MIDTRANS_SNAP_URL="https://app.midtrans.com/snap/snap.js"

# =========================================
# Cron Secret (WAJIB untuk keamanan cron)
# =========================================
CRON_SECRET="secure-random-string"   # Generate: openssl rand -base64 32

# =========================================
# AI Content Generation (Opsional)
# =========================================
DEEPSEEK_API_KEY="sk-xxx"           # DeepSeek V3 API key dari platform.deepseek.com

# =========================================
# OAuth & Email (Opsional)
# =========================================
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."
GITHUB_ID="..."
GITHUB_SECRET="..."
SMTP_HOST="smtp.example.com"
SMTP_PORT="587"
SMTP_SECURE="false"
SMTP_USER="..."
SMTP_PASS="..."
SMTP_FROM="SaCMS <no-reply@example.com>"

# =========================================
# Sentry Monitoring (Opsional)
# =========================================
SENTRY_DSN="https://xxx@sentry.io/xxx"
NEXT_PUBLIC_SENTRY_DSN="https://xxx@sentry.io/xxx"
```

## 3. Deployment: Vercel (Direkomendasikan)
Metode termudah. Sesuai dengan arsitektur Serverless Next.js SaCMS.

### 3.1. Konfigurasi `vercel.json`

Vercel menjalankan jadwal yang tercantum di `vercel.json`. Atur `CRON_SECRET` di environment production agar Vercel dapat mengirim header otorisasi. [Konfigurasi Vercel](../vercel.json)

### 3.2. Langkah Deploy
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy ke production
vercel --prod
```

Tambahkan semua Environment Variables dari **Section 2** di Vercel Dashboard → **Settings → Environment Variables**.

## 4. Deployment: Docker Compose (Self-hosted)

### 4.1. Jalankan image rilis

Compose membaca konfigurasi dari `.env`. Atur `SACMS_APP_IMAGE` ke digest image GHCR dari build yang akan dirilis. Untuk build lokal, jalankan `bun run build`, lalu `docker build -t sacms:local .` dan atur `SACMS_APP_IMAGE=sacms:local`. [Konfigurasi Compose](../docker-compose.yml)

```bash
docker compose up -d postgres redis
docker compose run --rm --no-deps app bun x prisma db push --skip-generate
docker compose run --rm --no-deps app bun scripts/migrate/verify-release-schema.ts
docker compose up -d
```

Terapkan SQL yang sudah ditinjau sebelum menjalankan `db push`. Pastikan database siap menerima koneksi setelah memulai layanan.

### 4.2. Cron self-hosted

Tambahkan profil `cron` ke `COMPOSE_PROFILES` dan atur `CRON_SECRET` di `.env`. Deploy CI membuat ulang kontainer cron aktif agar mengambil tabel jadwal yang baru. Untuk perubahan jadwal manual, gunakan `docker compose up -d --no-deps --force-recreate cron`. [Jadwal Docker](../docker/cron/crontab)

## 5. CI/CD GitHub Actions

Pipeline memeriksa tipe, lint, Vitest, dan build standalone. Job `critical-flows` menyiapkan dua database PostgreSQL sementara untuk menguji scheduled publishing, pemulihan pembayaran, pembuatan invoice bersamaan, dan kelanjutan deploy Website Template. Job deploy menunggu kedua job verifikasi dan menggunakan digest image dari build yang sama. [Workflow CI/CD](../.github/workflows/ci.yml)

Push ke `master` dan `develop` menggunakan VPS yang sama. Konfigurasikan *required reviewers* pada GitHub Environment `develop-deploy-approval` untuk menahan rilis `develop` sampai disetujui.

## 6. Pembaruan skema produksi

Pipeline menerapkan SQL yang sudah ditinjau di `db/manual-migrations/`, menjalankan `prisma db push --skip-generate` pada database utama, dan memverifikasi kolom yang dibutuhkan pada database utama dan dedicated. Deploy berhenti jika langkah ini gagal atau melewati batas waktu.

Jalankan pembaruan database dedicated secara terpisah dengan koneksi yang efektif untuk setiap workspace. Gunakan database yang sudah mendapat izin pengelolaan, termasuk saat workspace mewarisi koneksi dari pemilik akun.

```bash
bun run db:tenant:push <tenantSlugOrId>
bun run cli migrate:tenant <tenantSlugOrId>
bun run db:tenant:push --all
bun scripts/migrate/verify-release-schema.ts
```

Untuk rilis ini, verifikasi `tenant_single_type_assignments.draftData` pada database utama dan dedicated, serta `payment_transactions.fulfillmentStatus` pada database utama. [Validasi skema rilis](../scripts/migrate/verify-release-schema.ts)

## 7. Cron dan worker

Endpoint cron berikut menerima `Authorization: Bearer <CRON_SECRET>`. Jadwal menggunakan UTC.

| Endpoint atau perintah | Interval | Pemicu | Kegunaan |
|------------------------|----------|--------|----------|
| `GET /api/cron/publish` | Setiap 5 menit | Vercel dan Docker | Publikasi terjadwal ke database workspace |
| `GET /api/cron/webhook-retry` | Setiap 2 menit | Vercel dan Docker | Percobaan ulang pengiriman webhook dari DLQ |
| `GET /api/cron/payment-fulfillment` | Setiap 5 menit | Vercel dan Docker | Pemulihan pemenuhan pembayaran |
| `GET /api/cron/generate-invoices` | Harian 03:00 | Vercel dan Docker | Pembuatan invoice langganan yang jatuh tempo |
| `bun run cron:publish` | Sesuai kebutuhan | Worker CLI | Memproses entri terjadwal melalui database |

## 8. Docker & Standalone Production Build

Dalam container runtime (lihat `Dockerfile`), build production standalone dijalankan secara otomatis dengan:
```bash
# Build Next.js & salin standalone static assets via scripts/core/copy-standalone-assets.js
bun run build

# Menjalankan standalone server
bun run start
```
Healthcheck Docker memanfaatkan endpoint [`scripts/healthcheck.js`](../scripts/core/healthcheck.js):
```yaml
healthcheck:
  test: ["CMD", "bun", "scripts/healthcheck.js"]
  interval: 10s
  timeout: 5s
  retries: 5
```

## 9. Skrip Operasional & Developer CLI Terpadu

Untuk memudahkan DevOps dan tim pengembang, seluruh perintah manajemen dapat dijalankan melalui CLI terpadu:
```bash
# Tampilkan seluruh menu bantuan
bun run cli help

# Database & Seeding
bun run cli seed:global         # Inisialisasi skema & landing global
bun run cli seed:permissions    # Matriks izin RBAC & role defaults
bun run cli seed:pricing          # Inisialisasi tier paket langganan
bun run cli migrate:tenant demo # Push skema ke tenant dedicated
bun run cli migrate:fts         # Setup index PostgreSQL FTS

# Verifikasi & Keamanan
bun run cli qa:audit            # Audit route-by-route & latency test
bun run cli qa:security         # Security smoke tests (SSRF, auth gates)
bun run cli db:backup           # Backup database harian
```
