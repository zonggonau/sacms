# Starter Next.js untuk SaCMS

Starter minimal untuk membangun frontend di atas workspace SaCMS. Isinya sudah
siap pakai: SDK, helper data dengan penanganan status yang jelas, komponen UI
shadcn/ui, komponen konten SaCMS (richText, markdown, media), dan webhook
revalidasi.

- Next.js 16.4.6, React 19.3, Tailwind CSS v4
- `@sacms/sdk` 1.2.1 (versi yang sudah dipublikasikan di npm)
- Komponen shadcn/ui gaya `new-york`, warna netral

## Mulai cepat

```bash
cp .env.example .env.local   # isi nilai dari workspace Anda
npm install
npm run dev                  # http://localhost:3000
```

| Variabel | Keterangan |
|---|---|
| `SACMS_BASE_URL` | Alamat server SaCMS, tanpa garis miring di akhir. Wajib. |
| `SACMS_TENANT` | Slug workspace (lihat URL dashboard). Wajib. |
| `SACMS_API_TOKEN` | Token baca dari Developer & API → API Tokens. Opsional untuk konten publik. Hanya dipakai di server. |
| `SACMS_DEFAULT_LOCALE` | Locale konten, default `id`. |
| `SACMS_WEBHOOK_SECRET` | Secret untuk `/api/revalidate`. Kosongkan untuk menonaktifkan webhook. |

## Struktur

```
src/
  app/
    layout.tsx            Kerangka halaman, header, footer
    page.tsx              Beranda (Single Type "homepage")
    articles/page.tsx     Daftar artikel + pagination
    articles/[slug]/      Detail artikel
    api/revalidate/       Webhook SaCMS → refresh halaman
  lib/
    config.ts             NAMA koleksi dan field. Ubah di sini saja.
    env.ts                Membaca env, tanpa melempar error saat build
    sacms.ts              Client SDK (server only)
    content.ts            Pembacaan data: hasilnya ok / empty / error
    webhook.ts            Verifikasi tanda tangan HMAC
    utils.ts              cn() untuk class Tailwind
  components/
    ui/                   Komponen shadcn/ui
    sacms/                state (kosong/error), rich-text, markdown, media
```

## Skema yang diharapkan

Starter membaca nama berikut. Jika skema Anda berbeda, ubah `src/lib/config.ts`.

- **Koleksi `articles`**: `title` (text), `slug` (slug), `summary` (textarea),
  `body` (richText), `cover` (media).
- **Single Type `homepage`**: `headline` (text), `intro` (markdown).

Halaman tetap tampil bila sebuah nama tidak ada: halaman menampilkan status
kosong atau error, bukan crash.

## Aturan penting

- **Tiga status dibedakan.** `ok` berarti ada data. `empty` berarti belum ada
  konten yang dipublikasikan. `error` berarti permintaan gagal, dan pesan dari
  SaCMS ditampilkan. Error tidak pernah disamarkan sebagai halaman kosong.
- **richText selalu disanitasi** di `components/sacms/rich-text.tsx` sebelum
  dirender. SaCMS menyimpan HTML dari editor apa adanya.
- **Markdown** dirender dengan `react-markdown`, yang tidak menjalankan HTML mentah.
- **Media** memakai `<img>` biasa, sehingga bisa dari host penyimpanan mana pun
  tanpa mengubah konfigurasi.
- **Token hanya di server.** `sacms.ts` tidak boleh di-import dari file
  `"use client"`.
- **Halaman dibaca setiap request** (`dynamic = "force-dynamic"`), jadi
  perubahan yang sudah dipublikasikan langsung terlihat.

## Webhook revalidasi

1. Di SaCMS, buat webhook ke `https://<situs-anda>/api/revalidate` dengan
   secret yang sama dengan `SACMS_WEBHOOK_SECRET`.
2. SaCMS menandatangani body JSON dengan HMAC-SHA256 dan mengirim header
   `X-Webhook-Signature: sha256=<hex>`. Route ini memverifikasi tanda tangan
   dari body mentah sebelum membaca isinya.
3. Event `content.*` dan `media.*` memicu refresh seluruh situs. Event
   `content.before*` diabaikan karena itu hook sinkron, bukan perubahan.

Uji manual tanpa SaCMS:

```bash
BODY='{"event":"content.updated","data":{}}'
SIG=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac "$SACMS_WEBHOOK_SECRET" | sed 's/^.* //')
curl -X POST http://localhost:3000/api/revalidate \
  -H "content-type: application/json" \
  -H "x-webhook-event: content.updated" \
  -H "x-webhook-signature: sha256=$SIG" \
  -d "$BODY"
```

## Deploy

Bisa dijalankan di Vercel atau server Node.js (`npm run build && npm start`).
Set kelima variabel di atas di tempat deploy. Tanpa `SACMS_BASE_URL` dan
`SACMS_TENANT`, halaman menampilkan pesan konfigurasi, bukan error build.
