# Cron SaCMS

Vercel membaca jadwal dari `vercel.json`. Untuk Docker Compose, tambahkan `cron` ke `COMPOSE_PROFILES` di `.env`. Kedua pemicu menggunakan `Authorization: Bearer <CRON_SECRET>` dan jadwal UTC. [Jadwal Vercel](../../vercel.json) · [Jadwal Docker](../../docker/cron/crontab)

| Jadwal | Endpoint GET | Operasi |
|--------|--------------|---------|
| Setiap 5 menit | `/api/cron/publish` | Publikasikan entri yang jatuh tempo pada database workspace |
| Setiap 2 menit | `/api/cron/webhook-retry` | Ulangi pengiriman webhook dari antrean gagal |
| Setiap 5 menit | `/api/cron/payment-fulfillment` | Selesaikan pesanan dengan pembayaran yang sudah dikonfirmasi |
| Harian 03:00 | `/api/cron/generate-invoices` | Buat invoice untuk langganan aktif yang periodenya berakhir |
| Harian 02:00 | `/api/cron/purge-trash` | Bersihkan entri yang melewati masa pemulihan |

Jadwal pembersihan log, pengingat add-on, dan pemeriksaan lisensi tersedia di konfigurasi scheduler.

## Siklus penagihan

`GET /api/admin/billing/generate-invoices` memberi pratinjau. `POST` ke rute yang sama menjalankan siklus dari panel admin. Akses panel tersedia untuk super admin dan bendahara.

Jalankan permintaan berikut terhadap instalasi uji untuk mencoba pembuatan invoice.

```bash
curl -fsS -H "Authorization: Bearer ${CRON_SECRET}" http://localhost:3000/api/cron/generate-invoices
```

Invoice dibuat untuk langganan aktif yang periodenya berakhir dalam 30 hari terakhir dan tanpa pembatalan di akhir periode. Paket gratis memperpanjang periode. Worker menulis invoice paket berbayar dan periode baru dalam satu transaksi.

## Pemeriksaan kegagalan

Periksa status HTTP dan log pemicu. Endpoint invoice mengembalikan jumlah langganan yang diproses, dilewati, atau gagal. Untuk Docker, jalankan `docker compose logs cron`. Untuk Vercel, buka log pemanggilan cron pada project. [Panduan deployment](../../docs/07-Deployment_Guide.md) · [Runbook SaCMS](../../docs/08-Operations_and_Runbook.md)
