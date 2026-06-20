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
# Payment provider abstraction (Opsional)
# =========================================
PAYMENT_PROVIDER="midtrans"          # midtrans | stripe | xendit, sesuai flow aktif
STRIPE_SECRET_KEY="..."
XENDIT_SECRET_KEY="..."

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
**JANGAN PERNAH** menjalankan `prisma migrate dev` di production. Selalu gunakan:
```bash
# Deploy migrasi yang sudah dicommit
npx prisma migrate deploy

# Regenerate Prisma client (output: prisma/generated-client/)
npx prisma generate
```

## 7. Cron Jobs Setup
SaCMS mengandalkan background cron jobs untuk fitur scheduled publish dan webhook retry.

| Endpoint | Interval | Header Wajib |
|----------|----------|--------------|
| `GET /api/cron/publish` | Setiap 5 menit pada konfigurasi repository | `Authorization: Bearer <CRON_SECRET>` |
| `GET /api/cron/webhook-retry` | Setiap 2 menit pada konfigurasi repository | `Authorization: Bearer <CRON_SECRET>` |
| `GET /api/cron/backup` | Belum dijadwalkan di `vercel.json` | `Authorization: Bearer <CRON_SECRET>` |
| `GET/POST /api/admin/billing/generate-invoices` | Harian 00:00 pada konfigurasi repository | Ikuti autentikasi route admin/cron |

## 8. Catatan sinkronisasi Docker

`docker-compose.yml` di repository adalah konfigurasi operasional yang berbeda dari contoh minimal di dokumen ini. Sebelum dipakai di production:

- Ganti seluruh credential contoh/hard-coded.
- Pastikan healthcheck PostgreSQL menggunakan user yang benar.
- Pastikan aplikasi benar-benar membaca konfigurasi Redis yang diberikan; kode utama memakai `UPSTASH_REDIS_REST_URL/TOKEN`, bukan `REDIS_URL` biasa.
- Pastikan image Prisma yang dibangun menggunakan versi yang sama dengan `package.json`.
- Jangan menganggap service backup lokal menggantikan backup off-site dan uji restore.
