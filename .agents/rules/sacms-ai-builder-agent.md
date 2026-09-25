# SaCMS AI Builder Agent Operational Rules

Aturan ini wajib dipatuhi oleh setiap agen AI yang berinteraksi dengan **AI Website Builder** dan ekosistem frontend di SaCMS.

---

## 🎯 1. Multi-Tenant Schema-First Mandate
- **Multi-Tenancy Isolation:** Setiap tenant memiliki database atau isolasi skema tersendiri. Jangan pernah mengasumsikan skema global. Selalu periksa skema tenant via `McpClientBridge` atau endpoint `/api/public/${tenantSlug}/...`.
- **Schema Provisioning:** Jika prompt pengguna membutuhkan koleksi data baru (misal: `produk`, `destinasi`, `kamar`, `layanan`, `jadwal`), AI wajib memanggil tool `createContentType` atau `createSingleType` untuk membuat skema tabel/koleksi di database SaCMS tenant tersebut.
- **Fidelity Field Types:** Selalu cocokkan tipe field SaCMS:
  - `string` untuk teks singkat/judul/kategori
  - `text` untuk ringkasan/deskripsi paragraf
  - `richtext` untuk konten artikel panjang/spesifikasi
  - `number` untuk harga, stok, rating
  - `boolean` untuk status ketersediaan
  - `date` untuk tanggal/jadwal
  - `media` untuk URL gambar/video
  - `relation` untuk relasi antar koleksi
- **Real-Data Seeding:** Jangan biarkan API kosong. Selalu panggil tool `seedContentEntries` untuk mengisi 3-5 entri realistis berbahasa Indonesia.

---

## ⚡ 2. Multi-Framework Support & Vercel Hosting
- **Bukan Hanya Next.js:** Berikan rekomendasi dan dukung penuh framework yang dipilih pengguna:
  1. `nextjs` (Next.js 16 App Router) — Full-stack SSR/ISR, React Server Components (Vercel Native)
  2. `vite` (Vite 6 + React 19 SPA) — Client-side SPA ultra-cepat, Tailwind CSS (Vercel Static)
  3. `astro` (Astro 5 Islands) — Content-first, zero-JS by default, Lighthouse 100 (Vercel Static/Edge)
  4. `remix` (Remix / React Router v7) — Full-stack nested routing, Loaders & Actions (Vercel Serverless)
  5. `vue` (Vue 3 + Vite) — Composition API, SFC, Tailwind CSS (Vercel Static)
  6. `svelte` (SvelteKit 2) — Compiler-based reactivity, ukuran bundle mini (Vercel Serverless)
- **Struktur Berkas Standar:** Hasilkan berkas sesuai konvensi framework:
  - Client API: `lib/sacms.ts` atau `src/lib/sacms.ts`
  - TypeScript types: `types/cms.ts` atau `src/types/cms.ts`
  - Entry point: `app/page.tsx` (Next.js), `src/App.tsx` (Vite), `src/pages/index.astro` (Astro), `app/routes/_index.tsx` (Remix)
- **Vercel Readiness:** Pastikan berkas konfigurasi (`package.json`, build scripts, styling) siap untuk deployment langsung ke platform Vercel.

---

## 🎨 3. Standar Kualitas Kode & UI
- **Zero Placeholders:** Dilarang menghasilkan kode dengan komentar `// TODO`, `/* tambahkan di sini */`, atau fungsi yang tidak lengkap.
- **High-Res Unsplash Images:** Selalu gunakan URL Unsplash beresolusi tinggi yang relevan dengan tema (misal: pariwisata, kuliner, kesehatan, e-commerce).
- **Graceful Fallbacks:** Setiap komponen wajib menyertakan default data lokal yang kaya agar pratinjau live di sandbox Sandpack langsung menyala tanpa blank screen meskipun sedang offline.
- **Indonesian Currency & Locales:** Format mata uang menggunakan format Rupiah Indonesia yang benar (e.g. `Rp 28.000`).

---

## 🏛️ 4. Full-Page Multi-Section Mandate (v0 / Bolt.new / Lovable Standard)
- **Bukan Sekadar Skeleton:** Dilarang keras hanya menghasilkan halaman hero 30-50 baris atau kerangka kosong. Halaman utama (`app/page.tsx` atau `src/App.tsx`) wajib berdurasi visual penuh dari Navbar atas sampai Footer bawah (minimum 250-400 baris kode React/Tailwind siap produksi).
- **12+ Seksi Wajib Ada:**
  1. Sticky Floating Navbar (Logo, navigasi lengkap, badge, trigger pencarian, CTA aksi, mobile drawer).
  2. Immersive Hero (Eyebrow badge, headline tajam, subheadline persuasif, dual CTA, rating 5-bintang, tumpukan avatar 500+ pelanggan, visual produk resolusi tinggi).
  3. Bar Metrik & Bukti Sosial (4 angka statistik kunci dengan ikon).
  4. Keunggulan / Value Proposition (3-4 kartu fitur dengan ikon Lucide).
  5. Katalog / Menu / Showcase Produk Interaktif (Tab filter kategori dengan `useState`, live search bar, 6-8 kartu item dengan harga Rupiah, badge "Best Seller", tombol "Pesan / Tambah").
  6. Drawer / Modal Detail Pesanan Interaktif (Klik item memunculkan modal rincian, penghitung jumlah kuantitas, kalkulasi total, tombol langsung "Pesan via WhatsApp").
  7. Cerita Brand / Tentang Kami (Narasi mendalam mengenai asal-usul, keaslian bahan baku lokal, komitmen mutu).
  8. Galeri Fasilitas / Suasana (Grid visual ambience, tempat duduk, kenyamanan, Wi-Fi).
  9. Ulasan & Testimoni Pelanggan (3-4 kartu ulasan nyata dengan avatar, nama, rating bintang).
  10. Lokasi, Jam Operasional & Peta (Alamat lengkap, jadwal buka Senin-Minggu, nomor kontak/WA, tombol Google Maps).
  11. FAQ Accordion Interaktif (Tanya jawab seputar layanan/pesanan dengan toggle buka-tutup interaktif).
  12. Banner CTA Konversi Tinggi (Penawaran khusus / reservasi dengan tautan WhatsApp langsung).
  13. Footer Multi-Kolom Lengkap (Profil instansi, tautan navigasi, kontak, jam buka, hak cipta).

