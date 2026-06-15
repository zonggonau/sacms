# SaCMS Maintenance & Troubleshooting Guide

## 1. Pemeliharaan Rutin (Routine Maintenance)

### 1.1. Database Backups
Karena data adalah yang utama dalam Headless CMS, sangat direkomendasikan melakukan *Logical Backup* (misal: menggunakan `pg_dump`) setiap malam.
```bash
pg_dump -U username -h localhost dbname > sacms_backup_$(date +%F).sql
```
Pastikan backup disimpan ke tempat terpisah (misalnya S3 / AWS Glacier) secara otomatis.

### 1.2. Clearing Cache (Upstash Redis)
Jika terjadi inkonsistensi data antara CMS dan Front-End Anda akibat perubahan schema, Anda dapat menghapus *Cache*:
- Login ke Dashboard Upstash Redis Anda.
- Lakukan "Flush All" untuk menghapus semua rate-limits dan cache memory, atau dari console: `redis-cli flushall`.

## 2. Troubleshooting Umum

### 2.1. Prisma Database Connection Limits
**Masalah:** Error `Timeout fetching a connection from the pool` atau `Too many connections`.
**Solusi:**
- Pastikan string `DATABASE_URL` menggunakan *connection pooling* PgBouncer jika traffic Anda sangat tinggi, contoh menggunakan parameter `?connection_limit=10&pool_timeout=30`.
- Jika Anda menggunakan Serverless Deployment (seperti Vercel), sangat dianjurkan untuk menggunakan koneksi *Accelerate* dari Prisma atau setup database yang mensupport *serverless connection pools* seperti Supabase / Neon.

### 2.2. Gagal Upload Media ke Cloudflare R2
**Masalah:** Upload mandek atau muncul "Error 500".
**Solusi:**
- Cek batas `MAX_FILE_SIZE` di file konfigurasi.
- Pastikan variabel `R2_ACCESS_KEY_ID` dan `R2_SECRET_ACCESS_KEY` valid.
- Verifikasi bahwa Node.js memiliki izin melakukan `POST / PUT` ke Endpoint URL Cloudflare R2 Anda (CORS Policy di sisi bucket Cloudflare harus memperbolehkan origin Anda jika upload dilakukan dari client-side, namun SaCMS meng-handle via backend sehingga CORS tidak terlalu menjadi masalah).

### 2.3. Webhooks Gagal Mengirim (Dead Letter Queue)
**Masalah:** Data sudah di-publish tapi front-end statis tidak ter-rebuild otomatis.
**Solusi:**
- SaCMS menggunakan mekanisme asinkron. Periksa tabel `WebhookLog` dan `DeadLetter` di database untuk melihat respon error dari server tujuan.
- Pastikan cron job `/api/cron/webhook-retry` berjalan (biasanya di-trigger oleh Vercel Cron atau GitHub Actions scheduler) agar sistem bisa mem-push ulang request yang gagal.

### 2.4. Konten Terjadwal Tidak Ter-Publish
**Masalah:** Konten yang di-set "Scheduled Publish Date" tidak berubah menjadi "Published".
**Solusi:**
- Cek ketersediaan pemanggilan endpoint `/api/cron/publish`. Endpoint ini wajib dipanggil setiap menit oleh layanan eksternal (seperti cron-job.org atau Vercel Cron) dengan menyertakan `Authorization: Bearer <CRON_SECRET>`.

### 2.5. Error Tidak Terlacak di Log Server
**Masalah:** UI menampilkan error misterius "Internal Server Error" tapi log konsol kosong.
**Solusi:**
- Sistem telah dikonfigurasi dengan Sentry (`@sentry/nextjs`).
- Login ke dashboard Sentry Anda untuk melihat rekaman lengkap *Stack Trace*, *Breadcrumbs* perjalanan user, dan variabel *environment* saat error terjadi.
