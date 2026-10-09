---
name: sacms-frontend-builder
description: >-
  Universal Autonomous Schema-First AI Frontend Builder bertenaga SaCMS MCP ala v0.app.
  Menerima prompt standar apa pun untuk SEMUA jenis website (E-Commerce, F&B/Cafe, Klinik/Medis,
  Rental/Jasa, Company Profile, Portal Berita/Pemda, Hotel/Wisata, Edukasi), menganalisa domain
  dengan akurasi tinggi, membangun skema database SaCMS lengkap via MCP server, melakukan seeding
  data realistis terbit (PUBLISHED), dan menghasilkan frontend profesional interaktif setara v0.app / Lovable.
triggers:
  - build website
  - buat website
  - v0
  - generate frontend
  - bikin frontend
  - sacms frontend builder
  - bikin website
  - scaffold site
  - bangun schema
  - pilih framework
  - buat landing page
  - bikin web toko
  - buat web company profile
  - buat portal berita
  - buat website klinik
  - buat web rental
---

# Universal SaCMS Autonomous Frontend Builder (v0.app Grade)

Skill ini bertindak sebagai **Autonomous Full-Stack AI Engineer & Lead Database Architect Universal** untuk platform SaCMS. Skill ini dirancang untuk menangani **SEMUA jenis website** dari **prompt standar/singkat apa pun** yang diberikan pengguna (e.g. *"buat web rental mobil"*, *"bikin website klinik gigi"*, *"portal berita daerah"*, *"toko baju distro"*).

---

## ⚡ Prinsip Kerja Utama: Zero-Friction & High Accuracy

1. **User Cukup Menulis Prompt Standar**:
   Pengguna tidak perlu merinci struktur tabel database, tipe field satu per satu, atau format API. AI Agent secara mandiri menganalisis domain bisnis, memetakan entitas, dan mengeksekusi skema.

2. **Akurasi Tinggi via SaCMS MCP (`sacms`)**:
   Agent memanggil MCP Server SaCMS untuk:
   * Memeriksa database aktif via `get_full_schema`.
   * Membangun skema koleksi (`create_content_type`) dengan tipe field yang tepat dari 33 pilihan tipe data SaCMS (`currency` IDR, `richText`, `media`, `rating`, `tags`, `boolean`, dll.).
   * Membangun singleton data profil bisnis (`create_single_type`) dengan `initialData`.
   * Mengisi 4–6 data awal realistis berbahasa Indonesia (`create_content_entry` dengan status `PUBLISHED`) agar REST API publik langsung menghasilkan data riil.

3. **Frontend Kelas Dunia ala v0.app / Lovable**:
   * Desain visual disesuaikan secara dinamis dengan karakter industri (Medis = *Clean Teal*, F&B = *Warm Coffee/Terracotta*, Distro = *Modern Gold/Dark*, Pemda = *Authoritative Emerald*).
   * Arsitektur 12 seksi lengkap (Header, Hero, USP, Katalog/Menu/Layanan, Filter & Search, Modal Quick View/Detail, Cerita Brand, Testimoni, Info Lokasi & Jam Buka, FAQ Accordion, Footer).
   * Terintegrasi langsung dengan API publik SaCMS (`/api/public/{tenantSlug}/...`) dan dilengkapi **Zero-Downtime Mock Fallback** agar tidak pernah mengalami layar putih (*blank screen*).

---

## 🧭 Alur Kerja 5 Langkah Eksekusi Mandiri

```
[Prompt Pengguna: "buat website rental mobil di jayapura"]
                      │
                      ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│ LANGKAH 1: Klasifikasi Industri & Penalaran Domain Otomatis                  │
│ • Deteksi arketipe industri: E-Commerce / F&B / Layanan / Medis / Pemda / dll│
│ • Tentukan koleksi utama (e.g. `fleets`, `packages`, `reviews`)              │
│ • Tentukan singleton profil (e.g. `rental-profile`)                          │
└──────────────────────────────────────┬───────────────────────────────────────┘
                                       │
                                       ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│ LANGKAH 2: Provisi Skema Database via SaCMS MCP Tools                        │
│ 1. `get_full_schema`: Periksa apakah skema sudah ada                         │
│ 2. `create_content_type`: Buat koleksi dengan field berakurasi tinggi        │
│ 3. `create_single_type`: Buat singleton profil & informasi kontak           │
└──────────────────────────────────────┬───────────────────────────────────────┘
                                       │
                                       ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│ LANGKAH 3: Seeding Data Realistis (Status: PUBLISHED)                        │
│ • Eksekusi `create_content_entry` untuk 4–6 entri data demo berbahasa        │
│   Indonesia dengan gambar Unsplash resolusi tinggi                           │
│ • Verifikasi endpoint: `/api/public/{tenantSlug}/content/{slug}`             │
└──────────────────────────────────────┬───────────────────────────────────────┘
                                       │
                                       ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│ LANGKAH 4: Pemilihan Framework Frontend                                      │
│ • Next.js 16 (App Router)   : Full-stack SSR/ISR, Vercel Native              │
│ • Vite 6 + React 19 (SPA)   : Ultra-fast client SPA, Vercel Static           │
│ • Astro 5 (Islands)         : Content-first, Zero-JS, Lighthouse 100         │
│ • Remix / React Router v7   : Form mutations, Serverless                     │
└──────────────────────────────────────┬───────────────────────────────────────┘
                                       │
                                       ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│ LANGKAH 5: Kompilasi Frontend v0-Grade (12 Seksi Lengkap)                    │
│ • Tulis `src/App.tsx` atau `app/page.tsx` dengan komponen interaktif utuh    │
│ • Direct WhatsApp Booking / Order Generator                                 │
│ • Typed client `lib/sacms.ts` + Zero-Downtime Mock Fallback                  │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 🗺️ Matriks Penalaran Domain Otomatis

Agent secara otomatis memetakan prompt standar pengguna ke tabel berikut tanpa perlu konfirmasi manual yang membingungkan:

| Industri / Topik | Content Types (Koleksi) | Single Types (Singleton) | Fitur Kunci UI |
| :--- | :--- | :--- | :--- |
| **Toko Online / Distro / Fashion** | `products`, `categories`, `reviews` | `store-profile` | Filter kategori, Selector ukuran S–XXL, Format IDR, WhatsApp Checkout |
| **Cafe / Restoran / Kuliner** | `menu-items`, `categories`, `testimonials` | `restaurant-profile` | Tab menu makanan/minuman, Jam buka live, Reservasi meja |
| **Rental Kendaraan / Transportasi** | `fleets`, `packages`, `reviews` | `rental-profile` | Filter transmisi & kursi, Opsi lepas kunci/supir, Booking armada |
| **Klinik / Dokter / Kesehatan** | `doctors`, `services`, `patient-stories` | `clinic-profile` | Jadwal praktik dokter, Nomor SIP, Booking konsultasi medis |
| **Profil Perusahaan / Agensi B2B** | `portfolio`, `services`, `team-members` | `company-profile` | Bar statistik pencapaian, Studi kasus proyek, Kontak konsultasi |
| **Pemerintahan / OPD / Berita** | `articles`, `announcements`, `organizations`| `portal-settings` | Pencarian rilis berita, Unduhan SK/SE, Kontak darurat daerah |
| **Hotel / Resor / Wisata** | `rooms`, `tour-packages`, `galleries` | `resort-profile` | Pilihan tipe kamar, Fasilitas wisata, Cek ketersediaan |

---

## 🎨 Standar Komponen UI v0-Grade (Wajib 12 Seksi)

Kode frontend yang dihasilkan **wajib memiliki arsitektur lengkap 12 seksi** (tidak boleh hanya dummy navbar + hero):

1. **Top Announcement Bar**: Pengumuman promo, gratis ongkir, atau info operasional penting.
2. **Sticky Glassmorphic Navbar**: Logo brand, menu navigasi, search trigger, mobile drawer, dan tombol aksi utama.
3. **Immersive Hero Section**: Headline tajam bergradasi, sub-headline persuasif, dual CTA button, dan live metric stats bar.
4. **Value Proposition / USP Grid**: 4 kartu keunggulan kompetitif dengan ikon Lucide.
5. **Katalog / Daftar Layanan Interaktif**: Tab kategori filter dinamis (`useState`), input pencarian instan, dan dropdown pengurutan.
6. **Interactive Cards Grid**: Foto hover zoom, badge diskon/unggulan, harga Rupiah rapi (`Intl.NumberFormat`), dan rating bintang.
7. **Quick View / Detail Modal**: Pop-up detail saat item diklik (opsi varian, counter kuantitas, deskripsi lengkap).
8. **Direct WhatsApp Converter**: Tombol pemesanan langsung membuka chat WhatsApp dengan pesan detail terisi rapi.
9. **Brand Story / Filosofi Kualitas**: Narasi mendalam sejarah dan keunggulan bahan baku / komitmen layanan.
10. **Social Proof & Testimoni**: Grid ulasan dengan avatar pelanggan nyata dan status terverifikasi.
11. **Accordion FAQ Interaktif**: Pertanyaan dan jawaban umum yang dapat dibuka-tutup dengan mulus.
12. **Multi-Column Footer**: Identitas bisnis, jam buka, media sosial, logo metode pembayaran, dan copyright.

---

## 📚 Dokumen Spesifikasi & Rujukan

* 📋 **[Matriks Deteksi Domain](file:///d:/projek/z.ai/sacms/.agents/skills/sacms-frontend-builder/references/domain-detection-matrix.md):** Logika penalaran industri dan spesifikasi field detail.
* 🛠️ **[Cheatsheet MCP Schema](file:///d:/projek/z.ai/sacms/.agents/skills/sacms-frontend-builder/references/mcp-schema-cheatsheet.md):** Format parameter teknis untuk 33 field type SaCMS.
* 🎨 **[Standar Desain v0](file:///d:/projek/z.ai/sacms/.agents/skills/sacms-frontend-builder/references/v0-design-system.md):** Aturan visual, micro-interactions, dan WhatsApp message template.
* 🛍️ **[Blueprint Lintas Industri](file:///d:/projek/z.ai/sacms/.agents/skills/sacms-frontend-builder/references/industry-blueprints.md):** Pola schema dan UI untuk F&B, Medis, Rental, Corporate, dan Portal Publik.
