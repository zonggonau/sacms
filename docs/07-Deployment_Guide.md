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
Pastikan file `vercel.json` di root project mengkonfigurasi cron jobs:
```json
{
  "crons": [
    {
      "path": "/api/cron/publish",
      "schedule": "*/5 * * * *"
    },
    {
      "path": "/api/cron/webhook-retry",
      "schedule": "*/2 * * * *"
    },
    {
      "path": "/api/admin/billing/generate-invoices",
      "schedule": "0 0 * * *"
    }
  ]
}
```

### 3.2. Langkah Deploy
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy ke production
vercel --prod
```

Tambahkan semua Environment Variables dari **Section 2** di Vercel Dashboard → **Settings → Environment Variables**.

## 4. Deployment: Docker Compose (Self-hosted)

### 4.1. `docker-compose.yml`
```yaml
version: '3.9'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    env_file:
      - .env.production
    depends_on:
      postgres:
        condition: service_healthy
    restart: unless-stopped

  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: sacms
      POSTGRES_USER: sacms_user
      POSTGRES_PASSWORD: strong_password_here
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U sacms_user -d sacms"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped

volumes:
  postgres_data:
```

### 4.2. Build & Run
```bash
# Build image
docker build -t sacms:latest .

# Jalankan database migrasi (sekali saja)
docker compose run --rm app npx prisma migrate deploy

# Jalankan semua service
docker compose up -d
```

### 4.3. Cron Jobs (Self-hosted)
Jika tidak menggunakan Vercel Cron, tambahkan crontab di server:
```bash
# Edit crontab
crontab -e

# Tambahkan baris berikut:
*/5 * * * * curl -s -H "Authorization: Bearer YOUR_CRON_SECRET" https://your-domain.com/api/cron/publish
*/2 * * * * curl -s -H "Authorization: Bearer YOUR_CRON_SECRET" https://your-domain.com/api/cron/webhook-retry
```

## 5. CI/CD: GitHub Actions

Buat file `.github/workflows/deploy.yml`:

```yaml
name: CI/CD Pipeline

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    name: Unit Tests
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run test

  e2e:
    name: E2E Tests
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_DB: sacms_test
          POSTGRES_USER: test_user
          POSTGRES_PASSWORD: test_pass
        ports: ['5432:5432']
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npx playwright install --with-deps
      - run: npx prisma migrate deploy
        env:
          DATABASE_URL: postgresql://test_user:test_pass@localhost:5432/sacms_test
      - run: npx playwright test
        env:
          DATABASE_URL: postgresql://test_user:test_pass@localhost:5432/sacms_test

  deploy:
    name: Deploy to Production
    needs: [test]
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4
      - uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: '--prod'
```

## 6. Database Migration (Production)
**JANGAN PERNAH** menjalankan `prisma migrate dev` di production. Selalu gunakan Bun runtime:
```bash
# 1. Deploy migrasi skema yang sudah dicommit ke Database Utama
bunx prisma migrate deploy

# 2. Regenerate Prisma client (output: prisma/generated-client/)
bunx prisma generate

# 3. Push skema ke database dedicated tenant aktif (Enterprise / Hybrid)
bun run db:tenant:push <tenantSlugOrId>
# atau via CLI terpadu:
bun run cli migrate:tenant <tenantSlugOrId>
```

## 7. Cron Jobs Setup & Background Workers
SaCMS mengandalkan background cron jobs untuk fitur scheduled publish, webhook retry, dan pembuatan invoice billing.

| Endpoint / Command | Interval | Metode / Trigger | Deskripsi |
|--------------------|----------|------------------|-----------|
| `GET /api/cron/publish` | Setiap 5 menit | Vercel Cron (`Bearer <CRON_SECRET>`) | Memicu scheduled publishing via HTTP |
| `bun run cron:publish` | Sesuai crontab | Worker lokal / Docker (`bun run cli cron:publish`) | Memproses entri SCHEDULED langsung via database |
| `GET /api/cron/webhook-retry` | Setiap 2 menit | Vercel Cron (`Bearer <CRON_SECRET>`) | Pengiriman ulang pesan gagal di tabel DLQ |
| `POST /api/admin/billing/generate-invoices` | Harian 00:00 | Vercel Cron / Admin session | Pembuatan invoice langganan bulanan |
| `bun run cli db:backup` | Harian 02:00 | Linux crontab (`scripts/shell/db-backup.sh`) | Logical backup PostgreSQL dengan rotasi 7 hari |

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
bun run cli seed:plans          # Inisialisasi tier paket langganan
bun run cli migrate:tenant demo # Push skema ke tenant dedicated
bun run cli migrate:fts         # Setup index PostgreSQL FTS

# Verifikasi & Keamanan
bun run cli qa:audit            # Audit route-by-route & latency test
bun run cli qa:security         # Security smoke tests (SSRF, auth gates)
bun run cli db:backup           # Backup database harian
```
