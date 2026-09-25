---
name: sacms-frontend-builder
description: >-
  Autonomous Multi-Tenant Schema-First AI Frontend Builder bertenaga SaCMS MCP.
  Menganalisa kebutuhan domain dari prompt, memeriksa & membangun skema database SaCMS
  (Content Types, Single Types, Fields: string, text, richtext, number, boolean, date, media, relation),
  melakukan seeding data realistis via MCP tools, dan menghasilkan kode frontend modern
  untuk berbagai framework pilihan (Next.js 16 App Router, Vite + React SPA, Astro 5,
  Remix / React Router v7, Vue 3, SvelteKit) yang 100% kompatibel dengan Vercel hosting.
triggers:
  - build website
  - buat website
  - generate frontend
  - sacms frontend builder
  - bikin website
  - scaffold site
  - bangun schema
  - pilih framework
---

# SaCMS Autonomous Multi-Tenant Schema-First Frontend Builder

Skill ini bertindak sebagai **Autonomous Full-Stack AI Engineer & Database Architect** untuk platform SaCMS. Skill ini secara cerdas mengubah prompt pengguna (singkat maupun detail) menjadi:

1. **Skema Database SaCMS Siap Pakai** (Content Types, Single Types, Fields) yang diprovisi langsung via SaCMS Model Context Protocol (MCP) Server.
2. **Seeding Data Awal Realistis** berbahasa Indonesia sehingga REST API publik langsung aktif.
3. **Kode Frontend Terstruktur** sesuai framework pilihan pengguna (**Next.js 16 App Router**, **Vite + React 19 SPA**, **Astro 5**, **Remix**, **Vue 3**, **SvelteKit**) yang siap dideploy ke Vercel.

---

## 🏗️ Alur Kerja 4 Fase (Autonomous Schema-First Protocol)

```
[Prompt Pengguna] (e.g. "Buat website rental mobil di Papua dengan katalog armada dan booking online")
        │
        ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ FASE 1: Analisa Domain & Inspeksi Multi-Tenant Schema                   │
│ - Ekstrak entitas data: Koleksi (Content Types) & Singleton (Single Type)│
│ - Periksa skema tenant via MCP `get_full_schema` & `inspect_capabilities`│
│ - Identifikasi tipe field: string, text, richtext, number, boolean,     │
│   date, media, relation                                                 │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ FASE 2: Provisi Skema & Seeding Data via SaCMS MCP Tools               │
│ - Jika Content Type belum ada: Eksekusi `createContentType` via MCP     │
│ - Jika Single Type belum ada: Eksekusi `createSingleType` via MCP       │
│ - Eksekusi `seedContentEntries` untuk mengisi 3-5 data realistis        │
│   sehingga `/api/public/[tenant]/content/[slug]` langsung mengembalikan data│
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ FASE 3: Pemilihan & Penyesuaian Framework Frontend                      │
│ - Pilih/rekomendasikan framework yang optimal:                          │
│   * Next.js 16 (App Router)   : Full-stack SSR/ISR, Vercel Native       │
│   * Vite 6 + React 19 (SPA)   : Ultra-fast client SPA, Vercel Static    │
│   * Astro 5 (Islands)         : Content-first, Zero-JS, Lighthouse 100  │
│   * Remix / React Router v7   : Form mutations, Vercel Serverless       │
│   * Vue 3 + Vite              : Vue Composition API, Pinia              │
│   * SvelteKit 2               : Super-lean compiled reactivity          │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ FASE 4: Kompilasi & Scaffolding Frontend                                │
│ - `lib/sacms.ts`       : Typed API Client terhubung ke REST API tenant  │
│ - `types/cms.ts`       : TypeScript interfaces persis sesuai field DB   │
│ - Components & Pages   : Desain modern, Lucide Icons, Tailwind CSS      │
│ - Vercel Hosting Files : Konfigurasi deploy siap jalan                  │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 📊 Matriks Framework & Dukungan Vercel

| Framework           | ID       | Kategori       | Vercel Hosting | Entry Point               | API Client Path    | Sangat Cocok Untuk                                          |
| :------------------ | :------- | :------------- | :------------- | :------------------------ | :----------------- | :---------------------------------------------------------- |
| **Next.js 16**      | `nextjs` | Full-Stack     | Native         | `app/page.tsx`            | `lib/sacms.ts`     | E-Commerce, Portal Berita, OPD, Aplikasi SaaS, SEO Tinggi   |
| **Vite + React 19** | `vite`   | SPA            | Static         | `src/App.tsx`             | `src/lib/sacms.ts` | Dashboard Interaktif, Portofolio, Katalog Ringan, Web Tools |
| **Astro 5**         | `astro`  | Content/Static | Static/Edge    | `src/pages/index.astro`   | `src/lib/sacms.ts` | Blog, Wisata, Kuliner, Dokumentasi, Profil Perusahaan       |
| **Remix / RR v7**   | `remix`  | Full-Stack     | Serverless     | `app/routes/_index.tsx`   | `app/lib/sacms.ts` | Sistem Booking/Reservasi, Pendaftaran, Formulir Multi-Step  |
| **Vue 3 + Vite**    | `vue`    | SPA            | Static         | `src/App.vue`             | `src/lib/sacms.ts` | Ekosistem Vue, Internal Tools, Katalog Interaktif           |
| **SvelteKit 2**     | `svelte` | Full-Stack     | Serverless     | `src/routes/+page.svelte` | `src/lib/sacms.ts` | Web Ekstrem Ringan, Mobile-First PWA, Realtime              |

---

## 🧩 Aturan Pemetaan Field Schema SaCMS ke TypeScript

Setiap field yang dibuat pada Content Type harus dipetakan secara presisi ke TypeScript interface di `types/cms.ts`:

| Tipe Field SaCMS | TypeScript Type                                 | Komponen Tampilan Rekomendasi                                                                                    |
| :--------------- | :---------------------------------------------- | :--------------------------------------------------------------------------------------------------------------- |
| `string`         | `string`                                        | Judul, nama, teks pendek, badge kategori                                                                         |
| `text`           | `string`                                        | Ringkasan, cuplikan paragraf pendek                                                                              |
| `richtext`       | `string` (HTML/MD)                              | Konten artikel panjang, spesifikasi detail                                                                       |
| `number`         | `number`                                        | Harga (dengan format `Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' })`), stok, rating, durasi |
| `boolean`        | `boolean`                                       | Status ketersediaan (`isAvailable`), promo (`isFeatured`)                                                        |
| `date`           | `string` / `Date`                               | Tanggal terbit, deadline, jadwal kegiatan                                                                        |
| `media`          | `string` (URL)                                  | Thumbnail, foto galeri, logo institusi (gunakan fallback Unsplash resolusi tinggi jika offline)                  |
| `relation`       | `string` / `{ id: string; [key: string]: any }` | Kategori terkait, author, relasi induk-anak                                                                      |

---

## 🔌 Standar API Client SaCMS Multi-Tenant

### 1. Untuk Next.js / Remix / Full-Stack (`lib/sacms.ts`)

```typescript
const SACMS_API_URL =
  process.env.NEXT_PUBLIC_SACMS_URL || "http://localhost:3000";
const TENANT_SLUG = process.env.NEXT_PUBLIC_TENANT_SLUG || "default";

export async function getCollection<T = any>(
  contentType: string,
  options?: { limit?: number; page?: number; search?: string },
): Promise<{ data: T[]; total: number }> {
  try {
    const params = new URLSearchParams();
    if (options?.limit) params.set("limit", options.limit.toString());
    if (options?.page) params.set("page", options.page.toString());
    if (options?.search) params.set("search", options.search);

    const res = await fetch(
      `${SACMS_API_URL}/api/public/${TENANT_SLUG}/content/${contentType}?${params}`,
      {
        next: { revalidate: 60 },
      },
    );
    if (!res.ok) return { data: [], total: 0 };
    return await res.json();
  } catch (error) {
    console.warn(`Error fetching ${contentType} from SaCMS:`, error);
    return { data: [], total: 0 };
  }
}

export async function getSingle<T = any>(slug: string): Promise<T | null> {
  try {
    const res = await fetch(
      `${SACMS_API_URL}/api/public/${TENANT_SLUG}/single/${slug}`,
      {
        next: { revalidate: 60 },
      },
    );
    if (!res.ok) return null;
    const json = await res.json();
    return json.data || json;
  } catch (error) {
    console.warn(`Error fetching single ${slug} from SaCMS:`, error);
    return null;
  }
}
```

### 2. Untuk Vite SPA / Client-Side (`src/lib/sacms.ts`)

Menggunakan native `fetch` dengan fallback mock data otomatis agar halaman tidak pernah blank saat offline atau saat development lokal tanpa koneksi backend.

---

## 🎨 Standar Desain UI & Estetika Premium (v0 / Bolt.new / Lovable Standard)

Wajib membangun halaman utuh (Full-Page Multi-Section Architecture) dari Navbar hingga Footer dalam satu kesatuan yang kohesif:

1. **Sticky Floating Navbar:** Glassmorphism (`backdrop-blur-md`), navigasi lengkap, badge, search trigger, tombol CTA pemesanan, dan mobile menu drawer.
2. **Immersive Hero Section:** Headline berdampak, visual background gradient modern, dual CTA, badge rating bintang 5, tumpukan avatar pembeli nyata, dan gambar produk beresolusi tinggi.
3. **Bar Metrik & Bukti Sosial:** 4 statistik kunci pencapaian dengan ikon.
4. **Keunggulan / Value Proposition:** 3-4 kartu fitur dengan ikon Lucide.
5. **Katalog / Menu Interaktif:** Filter kategori dinamis (`useState`), live search input, 6-8 kartu item dengan harga Rupiah terformat (`Rp 28.000`), badge "Best Seller", dan tombol aksi pesan.
6. **Drawer / Modal Detail Pesanan:** Rincian interaktif saat item diklik, counter kuantitas, total harga otomatis, dan tombol direct WhatsApp order.
7. **Cerita Brand / Filosofi:** Narasi sejarah bisnis, keaslian bahan baku lokal, dan galeri foto.
8. **Fasilitas & Suasana:** Grid visual ambience, fasilitas kerja/nongkrong, Wi-Fi.
9. **Ulasan Pelanggan:** 3-4 testimoni nyata dengan rating bintang dan avatar.
10. **Lokasi & Jam Buka:** Alamat lengkap, jadwal buka operasional, tombol direct Google Maps.
11. **FAQ Accordion Interaktif:** Pertanyaan umum yang bisa dibuka-tutup.
12. **Banner CTA Penawaran:** Ajakan aksi dengan tombol WhatsApp.
13. **Footer Multi-Kolom:** Identitas brand, navigasi lengkap, kontak, media sosial, dan copyright.

---

## 📋 Checklist Eksekusi Mandiri AI Agent

- [ ] Analisis prompt: Apakah ada koleksi atau entitas data khusus yang diminta?
- [ ] Panggil `createContentType` / `createSingleType` untuk setiap entitas yang belum ada di database SaCMS tenant.
- [ ] Panggil `seedContentEntries` untuk mengisi 3-5 data realistis bahasa Indonesia.
- [ ] Tentukan framework target (Next.js 16, Vite React, Astro, Remix, Vue, atau SvelteKit).
- [ ] Hasilkan berkas utama (`app/page.tsx` atau `src/App.tsx`) dengan arsitektur penuh (12+ seksi dari Navbar ke Footer, minimum 250-400 baris kode).
- [ ] Gunakan `writeFile` untuk menghasilkan seluruh berkas proyek tanpa placeholder/TODO.
- [ ] Pastikan pratinjau lokal di Sandpack Sandbox langsung menyala dan interaktif secara utuh.
