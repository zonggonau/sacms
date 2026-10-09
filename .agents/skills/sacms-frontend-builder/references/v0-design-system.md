# v0-Grade Frontend UI & Design System Standards

Pedoman estetika, hierarki visual, dan pola komponen kelas dunia untuk menghasilkan kode frontend modern setara **v0.app**, **Lovable**, dan **Bolt.new**.

---

## 🎨 1. Aturan Emas Estetika (Golden Aesthetic Rules)

1. **Bukan Sekadar Template Dasar**:
   * Hindari desain kasar atau minimalis monoton. Buat tampilan yang memukau (*stunning first impression*) pada detik pertama dibuka.
   * Gunakan palet warna yang kohesif: Dark Mode elegan (Slate-950, Zinc-900, dengan border `border-white/10`) atau Clean Light Mode yang renyah (Stone-50, Slate-50 dengan aksen warna brand cerah).

2. **Tipografi & Kontras Tajam**:
   * Gunakan Google Fonts modern: `Plus Jakarta Sans`, `Outfit`, atau `Inter`.
   * Judul hero: `tracking-tight font-extrabold text-4xl sm:text-6xl`.
   * Gradient text pada kata kunci: `bg-gradient-to-r from-amber-400 via-orange-500 to-amber-600 bg-clip-text text-transparent`.

3. **Glassmorphism & Depth Layers**:
   * Header: `backdrop-blur-xl bg-background/80 border-b border-border/40 sticky top-0 z-50`.
   * Kartu konten: `bg-card/60 backdrop-blur-md border border-border/50 hover:border-primary/50 transition-all duration-300 hover:shadow-xl hover:-translate-y-1`.

4. **Mikro-Interaksi Dinamis**:
   * Badge terlaris berkedip lembut atau bersinar halus (`ring-1 ring-primary/30`).
   * Tombol CTA dengan efek hover transform dan ripple / scale (`active:scale-95 transition-transform`).
   * Filter kategori instan tanpa reload halaman (`useState` filter).

---

## 📐 2. Arsitektur 12 Seksi Wajib (Full-Page Completeness)

Setiap website yang dibuat **wajib mencakup 12 seksi lengkap dari atas ke bawah** (tidak boleh terpotong atau sekadar dummy hero):

1. **Top Promo Bar**: Pengumuman diskon / gratis ongkir se-Indonesia / promo terbatas.
2. **Sticky Floating Navbar**:
   * Logo brand & nama toko.
   * Navigasi desktop (Koleksi, Cerita Budaya, Testimoni, FAQ, Kontak).
   * Input pencarian cepat (*search trigger*).
   * Tombol keranjang belanja interaktif dengan badge counter `cart.length`.
   * Mobile drawer menu (*hamburger toggle*).
3. **Immersive Hero Section**:
   * Headline berdampak tinggi (*emotional hook* budaya/kualitas).
   * Sub-headline informatif.
   * Dual CTA button ("Lihat Koleksi" & "Konsultasi WhatsApp").
   * Bar statistik pencapaian (misal: "10.000+ Terjual", "100% Katun Combed Asli", "Rating 4.9/5").
   * Visual showcase produk resolusi tinggi dengan badge diskon mengambang.
4. **Keunggulan & USP (Value Proposition Grid)**:
   * 4 kartu fitur dengan ikon Lucide (Bahan Combed 24s/30s, Sablon Ramah Lingkungan, Jahitan Rantai Standar Ekspor, Garansi Tukar Size).
5. **Katalog Produk Dinamis (Interactive Filter & Search)**:
   * Tabs kategori interaktif ("Semua", "Edisi Budaya", "Edisi Minimalis", "Oversize", "Aksesoris").
   * Live search filter input & sort dropdown (Termurah, Termahal, Terlaris).
   * Grid kartu produk responsif (1 kolom di mobile, 2 di tablet, 3-4 di desktop).
6. **Kartu Produk Interaktif (Product Card Component)**:
   * Foto produk aspek rasio 1:1 atau 4:5 dengan hover zoom.
   * Badge kategori dan diskon ("Hemat Rp 26.000").
   * Nama produk, rating bintang 5, jumlah ulasan.
   * Harga Rupiah terformat rapi (`Rp 149.000`).
   * Tombol aksi ganda: **"Quick View"** dan **"Pesan Sekarang"**.
7. **Quick View Modal / Drawer**:
   * Modal pop-up saat produk diklik.
   * Pilihan ukuran (S, M, L, XL, XXL) yang bisa diklik aktif.
   * Counter kuantitas (+ / -).
   * Tombol direct WhatsApp Checkout otomatis menghitung total harga.
8. **Brand Story / Filosofi Produk**:
   * Narasi mendalam tentang identitas produk (misal: filosofi motif burung cenderawasih, ukiran suku Asmat, komitmen melestarikan warisan Papua).
   * Galeri visual proses produksi workshop / konveksi.
9. **Ulasan Pelanggan Asli (Social Proof & Reviews)**:
   * Grid 3-4 ulasan testimoni dengan avatar pembeli, kota asal (Jayapura, Jakarta, Surabaya), bintang rating, dan badge "Pembeli Terverifikasi".
10. **Informasi Toko & Jam Operasional**:
    * Alamat gerai fisik, jam buka, info pengiriman (JNE, J&T, Lion Parcel), dan tombol langsung ke Google Maps.
11. **Accordion FAQ Interaktif**:
    * Pertanyaan umum yang bisa dibuka-tutup (Cara pesan, panduan ukuran/size chart, estimasi ongkir, kebijakan retur).
12. **Multi-Column Footer**:
    * Branding & deskripsi toko.
    * Tautan menu cepat & media sosial.
    * Metode pembayaran yang didukung (QRIS, BCA, Mandiri, BRI, Bank Papua, COD).
    * Copyright resmi & status terverifikasi SaCMS.

---

## 🛍️ 3. Format Direct WhatsApp Order Generator

Setiap order harus dapat dialihkan langsung ke WhatsApp toko dengan pesan yang sudah terisi otomatis rapi:

```typescript
function openWhatsAppOrder(product: Product, size: string, qty: number, storePhone: string) {
  const total = product.price * qty;
  const message = `Halo Admin, saya ingin memesan produk berikut:
  
*Nama Produk:* ${product.name}
*Ukuran:* ${size}
*Jumlah:* ${qty} pcs
*Total Estimasi:* Rp ${total.toLocaleString('id-ID')}

Mohon informasi ketersediaan stok dan rekening pembayarannya. Terima kasih!`;

  const url = `https://wa.me/${storePhone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;
  window.open(url, '_blank');
}
```

---

## 🛡️ 4. Zero-Downtime Data Architecture (Client Fallback)

Di dalam file frontend (`src/App.tsx` atau `app/page.tsx`), **selalu sertakan `INITIAL_FALLBACK_DATA`** yang sudah terisi data lengkap bahasa Indonesia. 

Alur kerja:
1. Komponen melakukan `fetch` ke endpoint SaCMS Public REST API:
   ```ts
   const url = `${API_URL}/api/public/${TENANT_SLUG}/content/products`
   ```
2. Jika fetch berhasil dan mengembalikan array data $\rightarrow$ render data dari API SaCMS.
3. Jika fetch gagal (koneksi offline, API belum dideploy, atau error network) $\rightarrow$ otomatis beralih ke `INITIAL_FALLBACK_DATA` secara senyap tanpa menampilkan pesan error teknis kepada pengunjung.
