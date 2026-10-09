# Universal Domain Detection & Schema Mapping Matrix

Panduan penalaran otomatis (*automated domain reasoning*) bagi AI Agent untuk menerjemahkan **prompt standar apa pun** dari pengguna menjadi skema SaCMS berakurasi tinggi (Content Types, Single Types, dan Fields) secara instan.

---

## 🎯 Aturan Analisis Domain Otomatis (Zero-Friction Inference)

Ketika pengguna memberikan prompt singkat seperti:
* *"Buat website klinik dokter gigi di Surabaya"*
* *"Bikin portal berita kabupaten Intan Jaya"*
* *"Website cafe dan roastery kopi"*
* *"Web rental mobil dengan armada dan sopir"*
* *"Landing page jasa konsultan pajak"*

AI Agent **TIDAK PERLU** menanyakan pertanyaan berulang-ulang yang memperlambat proses. Agent harus langsung:
1. Mengidentifikasi **Arketipe Industri** dari tabel di bawah.
2. Memetakan koleksi utama (**Content Types**) beserta field-field esensialnya.
3. Memetakan singleton halaman (**Single Types**) untuk profil, jam buka, dan kontak.
4. Menentukan palet warna dan mood visual v0-grade yang selaras dengan industri tersebut.

---

## 🗺️ Matriks 8 Arketipe Industri Utama

| No | Arketipe Industri | Kata Kunci Prompt | Content Types (Koleksi) | Single Types (Singleton) | Nuansa Visual / Aksen Warna |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | **E-Commerce & Retail** | toko online, distro, fashion, baju, merchandise, tas, sepatu, skincare, produk | `products`, `categories`, `reviews` | `store-profile`, `shipping-info` | *Warm Gold, Amber, Rose, Modern Dark* |
| **2** | **F&B, Cafe & Restoran** | cafe, coffee shop, restoran, rumah makan, bakery, kuliner, menu makanan | `menu-items`, `menu-categories`, `testimonials` | `restaurant-profile`, `reservation-settings` | *Warm Coffee, Terracotta, Forest Green, Cream* |
| **3** | **Hospitality & Pariwisata** | hotel, resort, villa, penginapan, tour travel, wisata, diving, homestay | `rooms`, `tour-packages`, `galleries`, `reviews` | `resort-profile`, `facilities-info` | *Ocean Cyan, Tropical Emerald, Sunset Orange* |
| **4** | **Layanan & Jasa Booking** | rental mobil, cuci mobil, bengkel, barbershop, cleaning service, ekspedisi | `services`, `fleets` / `packages`, `testimonials` | `business-profile`, `booking-rules` | *Electric Blue, Vibrant Slate, High-Contrast Dark* |
| **5** | **Kesehatan & Medis** | klinik, dokter gigi, apotek, rumah sakit, lab medis, psikolog, fisioterapi | `doctors`, `services`, `patient-stories`, `faqs` | `clinic-profile`, `emergency-contacts` | *Clean Medical Teal, Cyan, Crisp White, Soft Gray* |
| **6** | **Profil Perusahaan & B2B** | company profile, agensi kreatif, software house, konsultan, kontraktor | `portfolio`, `services`, `team-members`, `clients` | `company-profile`, `brand-milestones` | *Deep Navy, Indigo, Violet, Sleek Minimalist* |
| **7** | **Pemerintahan & Publik** | portal berita, pemda, dinas, desa, opd, bappeda, dprd, puskesmas | `articles`, `announcements`, `organizations`, `agendas` | `portal-settings`, `leader-profile` | *Government Emerald Green, Gold Accent, Clean Slate* |
| **8** | **Edukasi & Yayasan** | sekolah, kampus, bimbel, pesantren, kursus online, yayasan donasi | `courses` / `programs`, `instructors`, `news`, `alumni` | `institution-profile`, `admissions-info` | *Academic Royal Blue, Amber Gold, Clean Ivory* |

---

## 📐 Standar Field Definition per Tipe Entitas

### 1. Entitas Katalog / Produk / Item (`products`, `menu-items`, `rooms`, `fleets`)
* `name` (`type: "text"`, required): Nama produk atau item.
* `slug` (`type: "text"`, required, unique): URL slug ramah SEO.
* `price` (`type: "currency"`, required, options: `{ "currencyCode": "IDR" }`): Harga utama.
* `discountPrice` (`type: "currency"`, options: `{ "currencyCode": "IDR" }`): Harga promo / diskon jika ada.
* `excerpt` (`type: "textarea"`, required): Ringkasan 1-2 kalimat untuk kartu pratinjau.
* `description` (`type: "richText"`): Uraian lengkap, spesifikasi, dan keunggulan.
* `category` (`type: "text"`, required): Kategori pengelompokan.
* `image` (`type: "media"`, required): Foto utama beresolusi tinggi (Unsplash).
* `gallery` (`type: "mediaMultiple"`): Koleksi foto pendukung.
* `rating` (`type: "rating"`): Nilai kepuasan (1-5).
* `isFeatured` (`type: "boolean"`): Highlight produk di halaman depan / rekomendasi utama.
* `isAvailable` (`type: "boolean"`): Ketersediaan stok atau jadwal.

### 2. Entitas Kategori (`categories`, `menu-categories`)
* `name` (`type: "text"`, required): Nama kategori.
* `slug` (`type: "text"`, required, unique): Slug identifier.
* `icon` (`type: "icon"`): Nama icon Lucide (misal: `"coffee"`, `"shirt"`, `"car"`).
* `description` (`type: "textarea"`): Deskripsi singkat kategori.

### 3. Entitas Testimoni / Ulasan (`reviews`, `testimonials`, `patient-stories`)
* `authorName` (`type: "text"`, required): Nama pelanggan / klien.
* `authorRole` (`type: "text"`): Pekerjaan, kota asal, atau status ("Pembeli Terverifikasi").
* `avatar` (`type: "media"`): Foto profil pelanggan.
* `rating` (`type: "rating"`, required): Bintang rating (4 atau 5).
* `comment` (`type: "textarea"`, required): Testimoni pengalaman positif.

### 4. Entitas Konten Berita / Artikel (`articles`, `news`)
* `title` (`type: "text"`, required): Judul artikel.
* `slug` (`type: "text"`, required, unique): URL slug.
* `content` (`type: "richText"`, required): Isi lengkap artikel.
* `excerpt` (`type: "textarea"`, required): Cuplikan ringkasan berita.
* `category` (`type: "text"`, required): Kategori berita.
* `coverImage` (`type: "media"`, required): Gambar banner artikel.
* `publishedAt` (`type: "datetime"`, required): Waktu penerbitan.
* `author` (`type: "text"`, required): Nama penulis / redaksi.

### 5. Singleton Profil Bisnis (`store-profile`, `clinic-profile`, `company-profile`)
* `name` (`type: "text"`, required): Nama resmi entitas/perusahaan.
* `tagline` (`type: "text"`): Slogan utama.
* `about` (`type: "richText"`): Narasi sejarah, visi-misi, dan filosofi.
* `whatsapp` (`type: "phone"`, required): Nomor WhatsApp aktif untuk konversi pemesanan langsung.
* `phone` (`type: "phone"`): Nomor telepon kantor.
* `email` (`type: "email"`): Email resmi.
* `address` (`type: "textarea"`, required): Alamat operasional fisik.
* `operatingHours` (`type: "text"`, required): Jadwal jam buka (misal: "Senin - Sabtu: 08.00 - 20.00 WIB").
* `mapsUrl` (`type: "url"`): Tautan Google Maps.
* `heroBanner` (`type: "media"`): Background banner visual utama.
