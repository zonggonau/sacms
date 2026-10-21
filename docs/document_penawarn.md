# Bahan Proposal Penawaran — SaCMS Enterprise

> **Catatan pemakaian:** Ini BUKAN proposal jadi — ini kumpulan fakta teknis & komersial yang sudah diverifikasi langsung dari kode SaCMS, supaya ChatGPT (atau siapa pun yang menulis proposal akhir) punya bahan yang akurat, bukan klaim generik. Setiap angka di sini bisa dipertanggungjawabkan ke kode sumbernya. Bagian "Catatan & Hal yang Perlu Dikonfirmasi" di akhir dokumen WAJIB dibaca sebelum mengirim proposal ke klien — ada beberapa klaim lama di dokumentasi internal yang sudah tidak berlaku dan jangan ikut ditawarkan.

---

## 1. Dua Model Penawaran Enterprise

SaCMS punya dua jalur komersial berbeda untuk segmen enterprise — bisa ditawarkan salah satu atau keduanya sebagai pilihan paket:

### A. SaCMS Cloud — Enterprise (hosted, dikelola SaCMS)
Klien tetap pakai infrastruktur SaCMS, tapi dengan limit jauh lebih besar dari paket biasa, plus opsi "bawa database/storage sendiri" (BYODB/BYOS). Cocok untuk perusahaan yang mau skala besar tanpa mengurus server sendiri.

### B. SaCMS Self-Hosted — Enterprise License (on-premise / server klien sendiri)
Klien menjalankan SaCMS di server mereka sendiri (via Docker Compose), SaCMS hanya memberi lisensi tahunan + dukungan. Cocok untuk instansi pemerintah atau perusahaan dengan kebutuhan kedaulatan data / kepatuhan ketat yang tidak boleh data-nya ada di server pihak ketiga.

Keduanya bisa jadi dua baris produk terpisah dalam satu proposal ("Cloud Enterprise" vs "Self-Hosted Enterprise").

---

## 2. Paket Lisensi Enterprise yang SUDAH ADA di sistem (harga riil, bukan contoh)

Ini bukan draf — ini tiga paket yang sudah benar-benar terkode di sistem admin (generator lisensi), lengkap dengan harga:

| Paket | Maks Workspace | Storage | Kredit AI | Harga / Tahun |
|---|---|---|---|---|
| 100 Workspace | 100 | 100 GB | 5.000 kredit | Rp 200.000.000 |
| 500 Workspace | 500 | 500 GB | 5.000 kredit | Rp 500.000.000 |
| Unlimited Workspace | Tidak terbatas | 1 TB (1024 GB) | 15.000 kredit | Rp 1.000.000.000 |

Catatan: satu lisensi = satu akun (tidak bisa dipakai bersama beberapa akun berbeda), berlaku 1 tahun, auto-override seluruh limit paket biasa begitu aktif. Admin juga bisa menyesuaikan storage/kredit AI/harga secara manual per lisensi yang sudah diterbitkan — jadi paket custom di luar 3 tabel di atas juga memungkinkan secara teknis.

---

## 3. Perbandingan Limit: Paket Biasa vs Tier "Enterprise" (plan bawaan)

Di luar lisensi account-level di atas, sistem juga punya tier plan bernama "enterprise" dengan limit tetap berikut (ini dasar argumen "kenapa harus upgrade"):

| Fitur | Free | Starter | Pro | **Enterprise** | Custom |
|---|---|---|---|---|---|
| Entri konten | 500 | 5.000 | 10.000 | **20.000** | Tak terbatas |
| Anggota tim | 1 | 3 | 10 | **20** | Tak terbatas |
| Panggilan API/bulan | 1.000 | 10.000 | 100.000 | **1.000.000** | Tak terbatas |
| Storage | 100 MB | 1 GB | 5 GB | **50 GB** | 100 GB |
| Jumlah bahasa (locale) | 1 | 2 | 5 | **20** | 99 |
| Retensi audit log | 0 hari | 7 hari | 30 hari | **365 hari** | — |
| Token AI | 50.000 | 100.000 | 500.000 | **2.000.000** | Tak terbatas |
| Domain custom | 5 | 10 | 25 | **50** | Tak terbatas |
| Support | Komunitas | Email | Priority | **24/7 Dedicated** | Custom |

Jenis Content Type selalu tak terbatas di semua paket — jadi bukan pembeda jual, jangan dipakai sebagai argumen.

---

## 4. "Bawa Database & Storage Sendiri" (BYODB/BYOS) — Argumen Jual Utama

Ini salah satu fitur paling kuat untuk dijual ke enterprise: akun dengan akses Enterprise (lisensi di atas, atau plan enterprise) bisa menghubungkan:
- Database PostgreSQL **milik mereka sendiri**
- Storage S3/MinIO-compatible **milik mereka sendiri**

Begitu disambungkan sekali di halaman akun, otomatis berlaku untuk SEMUA workspace yang dimiliki akun itu (kecuali workspace yang sudah punya koneksi sendiri). Ada tes koneksi otomatis dan endpoint inisialisasi skema sendiri — jadi onboarding-nya self-service, tidak perlu campur tangan tim SaCMS.

**Kenapa ini penting untuk dijual:** ini argumen kedaulatan data (data sovereignty) — data perusahaan tidak "nempel" di infrastruktur bersama SaCMS, tapi tetap pakai semua fitur SaCMS. Sangat relevan untuk instansi pemerintah, perbankan, atau perusahaan dengan kebijakan kepatuhan data yang ketat.

---

## 5. Fitur AI — Argumen Diferensiasi Produk

- **AI Schema Generator** — admin tinggal jelaskan jenis bisnis/website dalam bahasa natural, AI langsung merancang seluruh struktur data (Content Type, Single Type, Component, relasi antar-data) dalam hitungan detik, lengkap dengan field yang sesuai konteks (harga pakai tipe Currency, galeri pakai Media Multiple, dst).
- **Bisa membaca dokumen referensi** — admin bisa upload file `.docx`, `.xlsx`/`.xls`, `.pdf`, atau `.txt`/`.csv`/`.json` sebagai referensi, dan AI akan menganalisanya untuk ikut merancang skema. Khusus untuk template surat `.docx` yang punya variabel isian, AI otomatis mendeteksi variabelnya dan merancang skema yang field-nya langsung cocok dipakai untuk fitur generate-surat (lihat poin 7).
- **AI Smart Fill** — bantu mengisi form entri konten secara otomatis berdasarkan konteks, dengan perlindungan supaya tidak menimpa data yang sudah diisi manual.
- **Kredit AI jadi komoditas yang jelas** — setiap paket lisensi Enterprise punya jatah kredit AI sendiri (lihat tabel di poin 2), terpisah dari paket top-up kredit AI reguler yang bisa dibeli siapa saja (Rp mulai dari paket 300 kredit s/d 15.000 kredit). Ini bisa jadi argumen "AI Anda tidak akan kehabisan di tengah proyek besar."

---

## 6. Integrasi & Keterbukaan Platform (Argumen Teknis untuk Tim IT Klien)

- **MCP Server per workspace** — SaCMS menyediakan endpoint Model Context Protocol resmi, artinya tim developer klien bisa menghubungkan AI coding assistant mereka sendiri (Cursor, Windsurf, Claude Code, dll) langsung ke data SaCMS mereka — AI assistant itu bisa membaca skema, mengquery konten, dan membuat draft entri secara terprogram, dengan akses yang diamankan lewat token.
- **REST API + OpenAPI 3.0.3 otomatis per tenant** — setiap workspace otomatis punya dokumentasi API standar industri (bisa dibuka di Swagger UI), jadi tim developer klien tidak perlu menulis dokumentasi API dari nol.
- **GraphQL API publik per tenant** — alternatif untuk tim yang lebih nyaman dengan GraphQL dibanding REST.
- **Headless Member Auth** — sistem login/registrasi/lupa password/verifikasi email untuk end-user aplikasi klien (bukan admin CMS), mirip Strapi, siap pakai lewat API.
- **Webhook** — notifikasi otomatis ke sistem lain saat ada perubahan konten.
- **White-label & custom domain** (tersedia di paket Pro, Enterprise, Custom) — klien bisa pasang nama brand sendiri, logo sendiri, warna brand sendiri, favicon sendiri, bahkan alamat pengirim email sendiri, plus domain sendiri (`cms.namaperusahaan.com`) — dashboard CMS terasa seperti produk mereka sendiri, bukan "powered by SaCMS".

---

## 7. Fitur Operasional Konten (Argumen untuk Tim Non-Teknis / Editorial)

- **Generate surat/dokumen otomatis (DOCX)** — admin upload template surat Word yang punya variabel isian (`{nama}`, `{nomor_surat}`, dst), lalu setiap entri konten bisa langsung "diisi" ke dalam template itu dan diunduh sebagai dokumen Word yang sudah terisi — cocok untuk instansi yang banyak menerbitkan surat resmi, sertifikat, atau dokumen berulang.
- **Role & permission granular** — 7 level peran (Viewer, Subscriber, Contributor, Author, Editor, Admin, Owner), dengan kontrol izin per-anggota yang bisa disesuaikan lebih detail untuk workflow approval konten.
- **Trash / sampah dengan jendela waktu pulih** — konten yang terhapus tidak langsung hilang permanen, bisa dipulihkan dalam waktu tertentu sebelum benar-benar terhapus.
- **Audit log** — mencatat siapa melakukan apa, dengan retensi sampai 365 hari di tier Enterprise (vs 0-30 hari di paket bawah) — argumen kepatuhan/compliance yang konkret.
- **Backup otomatis** — database di-backup otomatis secara terjadwal.

---

## 8. Keamanan — Argumen untuk Tim Keamanan/Legal Klien

- Isolasi data antar-tenant (setiap workspace terpisah secara logis, dan dengan BYODB bisa terpisah secara fisik sampai level database sendiri).
- Validasi dan pembatasan akses untuk mencegah SSRF (server-side request forgery) di semua fitur yang menerima URL/koneksi dari pengguna (koneksi database/storage kustom, upload template, dll).
- Audit log terstruktur untuk jejak kepatuhan.
- Sistem lisensi yang terverifikasi secara kriptografis (bukan sekadar serial number teks biasa) untuk paket self-hosted.

---

## 9. Dukungan & Model Self-Hosted (dari dokumentasi internal `docs/enterprise/README.md`)

Opsi self-hosted (lihat bagian 1.B) sudah punya dokumentasi instalasi lengkap secara internal: instal via Docker Compose, lisensi diaktifkan lewat serial key, update dengan satu perintah, backup otomatis setiap 24 jam, dan dukungan grace period 7 hari kalau lisensi belum diperpanjang. Ini bisa langsung dijadikan bagian "proses onboarding" di proposal — kesannya profesional dan sudah teruji, bukan janji kosong.

---

## 10. Catatan & Hal yang Perlu Dikonfirmasi Sebelum Dikirim ke Klien

- **Jangan klaim "Unlimited Workspace/Member/Storage" secara mentah** untuk opsi self-hosted — dokumentasi internal lama (`docs/enterprise/README.md`) menyebut ini, tapi itu dokumen deployment teknis, bukan harga resmi terbaru. Kalau mau menjual opsi self-hosted dengan skema harga, sebaiknya konfirmasi dulu skema harganya ke tim internal — jangan asal pakai tabel 3 paket di poin 2 (itu khusus untuk skema Cloud Enterprise).
- **SDK (`@sacms/sdk`) belum resmi dipublikasikan ke npm** per sesi pengecekan terakhir (versi 1.1.0 baru ada lokal) — jangan dicantumkan sebagai "sudah bisa langsung dipakai publik" di proposal sampai ini dipastikan sudah rilis.
- Fitur "Starter Project Exporter" (export skema jadi starter project Next.js siap pakai) disebut di salah satu dokumentasi internal lama, tapi belum terverifikasi masih ada di kode saat ini — **jangan dicantumkan di proposal sampai dikonfirmasi ulang**, karena ada beberapa fitur AI generatif lain yang sudah sengaja dihapus dari produk belakangan ini.
- Data tabel di poin 2 dan 3 sudah diverifikasi langsung dari kode per hari ini — aman dipakai.
