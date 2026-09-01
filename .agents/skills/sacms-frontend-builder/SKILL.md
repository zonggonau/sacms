---
name: sacms-frontend-builder
description: >-
  Autonomous Next.js 16 + TailwindCSS Frontend Builder bertenaga SaCMS MCP.
  Membangun website lengkap (Next.js, TailwindCSS, TypeScript, Lucide Icons)
  secara otomatis dengan mengorkestrasi skema CMS, seeding data mock realistis
  via MCP tools, dan menghasilkan kode frontend yang langsung terhubung ke SaCMS API.
triggers:
  - build website
  - buat website
  - generate frontend
  - sacms frontend builder
  - bikin website
  - scaffold site
---

# SaCMS Autonomous Frontend Builder Skill

Skill ini bertindak sebagai **Autonomous Full-Stack AI Engineer** yang mengubah prompt pengguna (singkat maupun detail) menjadi website modern siap pakai berbasis **Next.js 16 + TailwindCSS**, terhubung langsung dengan backend **SaCMS Headless CMS via Model Context Protocol (MCP)**.

---

## 🎯 Perilaku Utama (Default vs Detailed Prompt)

1. **Prompt Minimal / Singkat (Default Mode):**
   - Contoh: *"Buat website dinas kesehatan"*, *"Bikin web pariwisata"*, *"Buat web sekolah"*.
   - **Tindakan Skill:** Mengaktifkan **Smart Archetype Engine** bawaan (skema CMS lengkap, komponen UI standar industri, palet warna elegan, dan 4-6 data contoh realistis bahasa Indonesia) tanpa perlu menanyakan konfirmasi berulang kali.

2. **Prompt Detail / Spesifik (Custom Mode):**
   - Contoh: *"Buat web dinas kesehatan dengan warna emerald green, ada modul antrean puskesmas, halaman data stunting dengan grafik, dan formulir pengaduan online"*.
   - **Tindakan Skill:** Mengikuti seluruh spesifikasi dan fitur khusus yang diminta user secara presisi, lalu melengkapi bagian yang belum dispesifikasikan (struktur folder, SEO, TypeScript types, dan error handling) menggunakan standar terbaik SaCMS.

---

## 🏗️ Alur Kerja 4 Tahap (End-to-End Execution)

```
[Prompt Pengguna] (e.g. "Buat website dinas kesehatan")
        │
        ▼
┌─────────────────────────────────────────────────────────┐
│ TAHAP 1: Analisis Domain & Perancangan Skema CMS        │
│ - Tentukan Content Types, Single Types, & Components    │
│ - Tentukan palet warna, tipografi, dan tata letak UI    │
└──────────────────────────┬──────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│ TAHAP 2: Eksekusi MCP Tools ke SaCMS Backend            │
│ 1. `inspect_api_capabilities` & `get_full_schema`       │
│ 2. `create_content_type` (e.g. berita, faskes, layanan) │
│ 3. `create_single_type` (e.g. profil-dinas, kontak)     │
│ 4. `create_content_entry` (Seeding 3-5 data realistis)  │
└──────────────────────────┬──────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│ TAHAP 3: Generasi Kode Frontend (Next.js + TailwindCSS) │
│ - `src/lib/sacms.ts`       : Typed SaCMS API Client     │
│ - `src/types/cms.ts`       : TypeScript interfaces      │
│ - `src/components/*`       : UI Components modern       │
│ - `src/app/*`              : Server Components & Routes │
└──────────────────────────┬──────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│ TAHAP 4: Verifikasi & Laporan Hasil                     │
│ - Validasi build / typecheck                            │
│ - Panduan menjalankan (`bun run dev`) & dokumentasi     │
└─────────────────────────────────────────────────────────┘
```

---

## 📚 Katalog Domain Bawaan (Smart Archetypes)

Jika user memberikan prompt singkat, gunakan cetak biru (*archetype*) berikut secara otomatis:

### 1. Dinas Kesehatan / Rumah Sakit / Faskes (`dinas-kesehatan`)
- **Warna:** Emerald (`#059669`), Teal (`#0d9488`), Slate (`#0f172a`).
- **Content Types (MCP):**
  - `berita-kesehatan` (title, slug, excerpt, content [richText], category, featuredImage, publishedAt)
  - `layanan-kesehatan` (name, slug, description, icon, persyaratan [richText], alurLayanan, waktuLayanan)
  - `fasilitas-kesehatan` (name, type [Puskesmas/RSUD/Klinik], address, phone, emergencyPhone, googleMapsUrl, photo)
  - `jadwal-dokter` (doctorName, specialist, day, timeStart, timeEnd, faskesSlug)
- **Single Types (MCP):**
  - `profil-dinas` (namaDinas, kepalaDinasName, kepalaDinasPhoto, sambutan, visiMisi [richText], strukturOrganisasi)
  - `kontak-darurat` (hotline119, ambulancePhone, whatsappDarurat, alamatKantor, email)
- **Komponen UI Wajib:** Emergency 119 Quick Banner, Pencarian Faskes, Jadwal Dokter, Berita & Edukasi Kesehatan, Statistik Layanan.

### 2. Portal Pemerintah Daerah / OPD (`pemerintah-daerah`)
- **Warna:** Navy Blue (`#1e3a8a`), Gold/Amber (`#d97706`), Neutral Gray.
- **Content Types (MCP):** `berita-daerah`, `pengumuman`, `layanan-publik`, `agenda-kegiatan`, `transparansi-anggaran`.
- **Single Types (MCP):** `profil-daerah`, `sambutan-bupati`, `kontak-layanan`.

### 3. Pariwisata & Kebudayaan (`pariwisata`)
- **Warna:** Cyan / Ocean Blue (`#0891b2`), Sunset Amber (`#f59e0b`), Dark Slate.
- **Content Types (MCP):** `destinasi-wisata`, `kuliner-khas`, `akomodasi`, `event-festival`, `paket-tour`.
- **Single Types (MCP):** `panduan-wisata`, `tentang-kami`, `kontak-tourist-center`.

### 4. Sekolah / Universitas / Pendidikan (`pendidikan`)
- **Warna:** Royal Indigo (`#4338ca`), Sky Blue (`#0284c7`), White.
- **Content Types (MCP):** `jurusan-prodi`, `berita-kampus`, `prestasi`, `fasilitas-pendidikan`, `agenda-akademik`.
- **Single Types (MCP):** `profil-sekolah`, `info-pendaftaran-ppdb`, `kontak-sekolah`.

### 5. Korporat & Startup Bisnis (`corporate`)
- **Warna:** Slate Dark (`#090d16`), Indigo Electric (`#6366f1`), Violet.
- **Content Types (MCP):** `produk-layanan`, `studi-kasus`, `testimoni`, `blog-insight`, `tim-manajemen`.
- **Single Types (MCP):** `tentang-perusahaan`, `halaman-karir`, `kontak-bisnis`.

---

## 🛠️ Panduan Eksekusi Teknis Step-by-Step

### Langkah 1: Inspeksi & Sinkronisasi MCP SaCMS
1. Panggil MCP `inspect_api_capabilities` untuk memeriksa hak akses tenant.
2. Panggil MCP `get_full_schema` untuk melihat tipe data yang sudah ada di SaCMS.
3. Bandingkan dengan kebutuhan website:
   - Jika tipe data belum ada: Buat baru menggunakan `create_content_type` atau `create_single_type`.
   - Jika sudah ada: Gunakan skema yang ada dan lanjutkan ke tahap seeding.

### Langkah 2: Seeding Data Mock Realistis via MCP
1. Untuk setiap Content Type yang dibuat, panggil `create_content_entry` minimal 3-5 entri.
2. Gunakan data bahasa Indonesia yang realistis, relevan dengan konteks daerah/kesehatan/bisnis (bukan "Lorem Ipsum").
3. Set status entri ke `PUBLISHED`.
4. Untuk Single Type (misal `profil-dinas`), panggil `update_single_type_content` dengan konten lengkap.

### Langkah 3: Scaffolding Frontend Next.js 16 + TailwindCSS

Pastikan kode yang dibuat memiliki struktur modular berikut:

#### 1. API Client Helper ([`src/lib/sacms.ts`](file:///d:/projek/z.ai/sacms/src/lib/sacms.ts))
```typescript
const SACMS_API_URL = process.env.NEXT_PUBLIC_SACMS_URL || "http://localhost:3000"
const TENANT_SLUG = process.env.NEXT_PUBLIC_TENANT_SLUG || "default"

export async function getCollection<T = any>(
  contentType: string,
  options?: { limit?: number; page?: number; search?: string }
): Promise<{ data: T[]; total: number }> {
  try {
    const params = new URLSearchParams()
    if (options?.limit) params.set("limit", options.limit.toString())
    if (options?.page) params.set("page", options.page.toString())
    if (options?.search) params.set("search", options.search)

    const res = await fetch(`${SACMS_API_URL}/api/public/${TENANT_SLUG}/content/${contentType}?${params}`, {
      next: { revalidate: 60 }, // ISR Cache 60 detik
    })
    if (!res.ok) return { data: [], total: 0 }
    return await res.json()
  } catch (error) {
    console.error(`Error fetching ${contentType}:`, error)
    return { data: [], total: 0 }
  }
}

export async function getSingle<T = any>(slug: string): Promise<T | null> {
  try {
    const res = await fetch(`${SACMS_API_URL}/api/public/${TENANT_SLUG}/single/${slug}`, {
      next: { revalidate: 60 },
    })
    if (!res.ok) return null
    const json = await res.json()
    return json.data || json
  } catch (error) {
    console.error(`Error fetching single ${slug}:`, error)
    return null
  }
}
```

#### 2. Desain UI & Standar Komponen
- **Header & Navbar:** Logo instansi, link navigasi dinamis, kontak darurat, search bar, mode malam (dark mode).
- **Hero Section:** Judul utama berdampak, tagline, visual background gradient modern, dan tombol Call-to-Action (CTA).
- **Service Cards / Grid:** Tampilan kartu interaktif dengan ikon Lucide, efek hover 3D/glow subtle, dan badge kategori.
- **News / Articles Grid:** Thumbnail gambar teroptimasi, tanggal terbit, tag kategori, cuplikan ringkas.
- **Footer:** Informasi alamat lengkap, tautan cepat, media sosial, copyright, dan badge "Powered by SaCMS".

---

## 📊 Format Laporan Selesai (Output ke User)

Setelah selesai membangun, tampilkan ringkasan:
1. **Model CMS yang Dibuat di SaCMS:** Daftar Content Types & Single Types beserta jumlah entri yang di-seed.
2. **Halaman & Komponen Frontend:** Daftar rute yang dibuat (`/`, `/layanan`, `/berita`, `/faskes`, `/kontak`).
3. **Perintah Menjalankan:**
   ```bash
   bun run dev
   ```
4. **Link Preview & Dashboard SaCMS:** Arahkan user ke dashboard untuk mulai mengelola konten secara visual.
