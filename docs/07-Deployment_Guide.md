# SaCMS Deployment & Operations Guide

## 1. Persyaratan Sistem (Prerequisites)
Sebelum melakukan deployment, pastikan Anda memiliki:
- Node.js v20.x atau terbaru.
- PostgreSQL (v14+).
- Akun Cloudflare R2 untuk penyimpanan media (atau AWS S3).
- Akun Upstash Redis (untuk rate limit dan cache).
- Akun Midtrans (untuk payment gateway).

## 2. Environment Variables (`.env`)
Buat file `.env` di production berdasarkan contoh ini:
```env
# URL & NextAuth
NEXT_PUBLIC_APP_URL="https://your-domain.com"
NEXTAUTH_URL="https://your-domain.com"
NEXTAUTH_SECRET="random_strong_string"

# Database
DATABASE_URL="postgresql://user:pass@host:5432/sacms?schema=public"

# Upstash Redis
UPSTASH_REDIS_REST_URL="https://xxx.upstash.io"
UPSTASH_REDIS_REST_TOKEN="xxxx"

# Cloudflare R2
R2_ACCOUNT_ID="xxx"
R2_ACCESS_KEY_ID="xxx"
R2_SECRET_ACCESS_KEY="xxx"
R2_BUCKET_NAME="sacms-media"
R2_PUBLIC_URL="https://media.your-domain.com"

# Midtrans
MIDTRANS_MODE="production"
MIDTRANS_SERVER_KEY="xxx"
MIDTRANS_CLIENT_KEY="xxx"
```

## 3. Langkah Deployment Manual (VPS / Bare Metal)
1. Clone repositori ke server.
2. Jalankan instalasi depedensi:
   ```bash
   npm install
   ```
3. Lakukan sinkronisasi database:
   ```bash
   npx prisma migrate deploy
   npx prisma generate
   ```
4. Build aplikasi Next.js:
   ```bash
   npm run build
   ```
5. Jalankan aplikasi menggunakan PM2 (Process Manager):
   ```bash
   pm2 start npm --name "sacms" -- run start
   ```

## 4. Cron Jobs Setup
SaCMS mengandalkan beberapa background cron jobs. Panggil endpoint cron ini setiap menit (misalnya via Vercel Cron, atau Linux `crontab` jika di VPS).
- `GET /api/cron/publish` (Untuk auto-publish Scheduled Content)
- `GET /api/cron/webhook-retry` (Untuk memproses ulang webhook yang gagal)

Pastikan menyertakan Header `Authorization: Bearer <CRON_SECRET>` jika endpoint cron diproteksi.
