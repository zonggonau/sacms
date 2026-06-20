# Operations Runbook & Incident Handling

Dokumen ini adalah panduan *Operations Manual* untuk memulihkan layanan (Runbook) jika terjadi insiden teknis atau *downtime* pada infrastruktur SaCMS, beserta format pelaporan insiden (*Incident Report*).

---

## 1. Runbook: Troubleshooting Sistem

### Skenario A: API Rate Limiting Error (Redis Down)
**Gejala:** Endpoint API mengembalikan status `500 Internal Server Error` secara acak, atau *fallback* gagal membaca Redis.
**Langkah Mitigasi:**
1. Cek dashboard **Upstash Redis**. Pastikan limit *requests per month* belum melampaui batas (jika menggunakan *Free Tier*).
2. Periksa rotasi `UPSTASH_REDIS_REST_TOKEN` di *Environment Variables*.
3. Jika Upstash sedang *outage*, sistem memiliki algoritma *in-memory fallback* (lihat `lib/rate-limit.ts`). Pastikan *traffic* tidak sedang mengalami lonjakan DDoS yang dapat menghabiskan memori kontainer Vercel/Docker.

### Skenario B: Media Upload Gagal (Cloudflare R2 Down)
**Gejala:** *Upload* gagal dengan status `502 Bad Gateway` atau lambatnya *thumbnail generation*.
**Langkah Mitigasi:**
1. Verifikasi `R2_ACCESS_KEY_ID` dan `R2_SECRET_ACCESS_KEY`.
2. Pastikan file *bucket* publik dapat diakses melalui URL kustom yang dikonfigurasi di Cloudflare DNS.
3. Periksa ketersediaan kuota *Storage* pada *Enterprise Dashboard* Anda.
4. *Restart service* jika koneksi terputus tiba-tiba akibat perubahan kebijakan *bucket*.

### Skenario C: Database PostgreSQL Unresponsive
**Gejala:** Aplikasi memunculkan `PrismaClientKnownRequestError` atau kehabisan koneksi (*Connection Pool Exhausted*).
**Langkah Mitigasi:**
1. Cek PostgreSQL *connection pool* (PgBouncer/Supabase dashboard).
2. Verifikasi penggunaan koneksi database via `getTenantDb()` (pastikan tidak ada memori *leak* koneksi yang tidak terputus).
3. Jika disk penuh, pertimbangkan *scale-up storage* atau hapus *Archive Logs*.
4. Lakukan *restore backup* dari jam sebelumnya jika terjadi kerusakan data yang parah (via fitur *Point-in-Time Recovery* penyedia DB Anda).

### Skenario D: Webhook Macet (Cron DLQ)
**Gejala:** *Webhook* tidak terkirim ke pelanggan (*tenant endpoint* mati).
**Langkah Mitigasi:**
1. Pemicu utama kegagalan Webhook otomatis ditransfer ke tabel *Dead Letter Queue (DLQ)* di DB.
2. *Cron job* `/api/cron/webhook-retry` berjalan setiap 2 menit pada `vercel.json` saat ini dengan skema *exponential backoff*.
3. Periksa `WebhookLog`, `WebhookDeadLetter`, dan halaman Webhooks tenant; Sentry hanya tambahan jika dikonfigurasi.

---

## 2. Template Incident Report

Setiap terjadi *downtime* sistem > 10 menit atau kebocoran data, Tim DevOps harus mengisi *Incident Report* berikut:

```markdown
# Incident Report: [Nama Insiden]
**Tanggal Kejadian:** [YYYY-MM-DD]
**Waktu Kejadian:** [HH:MM] s.d. [HH:MM]
**Reporter:** [Nama & Role]

### 1. Deskripsi Insiden
[Jelaskan apa yang terjadi, misal: Public API tidak bisa diakses dan mengembalikan error 503]

### 2. Dampak (Impact)
[Jelaskan dampaknya terhadap Tenant/Client, misal: Seluruh proses checkout via e-commerce client tertunda]

### 3. Akar Masalah (Root Cause)
[Identifikasi apa yang menyebabkan masalah ini terjadi, misal: Prisma Connection Pool habis karena traffic spike dari Tenant A]

### 4. Tindakan Penyelesaian (Resolution)
[Langkah-langkah yang diambil untuk memperbaiki layanan saat itu juga, misal: Melakukan restart server dan menambah PgBouncer pool size menjadi 200]

### 5. Langkah Preventif
[Apa yang akan dilakukan agar ini tidak terjadi lagi, misal: Menurunkan batas rate-limit dari 1000 ke 500 req/min untuk plan Free]
```
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
- SaCMS menggunakan mekanisme asinkron. Periksa tabel `WebhookLog` dan `WebhookDeadLetter` di database untuk melihat respon error dari server tujuan.
- Pastikan cron job `/api/cron/webhook-retry` berjalan (biasanya di-trigger oleh Vercel Cron atau GitHub Actions scheduler) agar sistem bisa mem-push ulang request yang gagal.

### 2.4. Konten Terjadwal Tidak Ter-Publish
**Masalah:** Konten yang di-set "Scheduled Publish Date" tidak berubah menjadi "Published".
**Solusi:**
- Cek pemanggilan endpoint `/api/cron/publish`. Konfigurasi repository saat ini menjalankannya setiap 5 menit dengan `Authorization: Bearer <CRON_SECRET>`.

### 2.5. Error Tidak Terlacak di Log Server
**Masalah:** UI menampilkan error misterius "Internal Server Error" tapi log konsol kosong.
**Solusi:**
- Sistem telah dikonfigurasi dengan Sentry (`@sentry/nextjs`).
- Login ke dashboard Sentry Anda untuk melihat rekaman lengkap *Stack Trace*, *Breadcrumbs* perjalanan user, dan variabel *environment* saat error terjadi.

### 2.6. Konten Tertahan di Workflow
**Masalah:** Tombol status tidak muncul, reviewer tidak dapat memutuskan, atau entri tidak berpindah status.

**Solusi:**

1. Catat status saat ini dan status target.
2. Cocokkan transisi dengan dokumen 14.
3. Periksa role/custom permission actor.
4. Untuk review berurutan, ambil assignment dari `/api/tenant/{tenant}/workflow/reviewers?entryId=...` dan pastikan actor adalah pending reviewer dengan urutan terkecil.
5. Pastikan entry masih berada pada tenant dan status `IN_REVIEW` saat keputusan dikirim.
6. Jika schedule gagal, pastikan tanggal valid dan berada di masa depan menurut waktu server.

### 2.7. Custom Domain Verified tetapi Tidak Routing
**Masalah:** Database menunjukkan `verified`, tetapi hostname tidak di-rewrite.

**Solusi:**

1. Periksa Upstash Redis dan key `domain:{hostname}`.
2. Pastikan `NEXT_PUBLIC_APP_URL` mengarah ke canonical app host.
3. Ulangi POST verifikasi domain setelah Redis pulih untuk mengisi ulang mapping.
4. Panggil path custom host `/content/...`, bukan `/api/public/{tenant}/...`.
5. Sertakan Bearer token tenant pada request API.

## 3. Evidence policy

Runbook harus membedakan “kode tersedia” dan “operasi terverifikasi”. Catat timestamp, environment, actor, request ID, endpoint, status code, dan perubahan yang dilakukan. Jangan menyatakan restore, backup, cron, atau provider sehat hanya berdasarkan inspeksi source code.
