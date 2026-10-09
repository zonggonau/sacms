# Blueprint Skema & UI Lintas Industri (Multi-Industry Blueprints)

Katalog blueprint siap pakai untuk memandu AI Agent saat mengeksekusi MCP Schema Creation dan Frontend Scaffolding lintas industri.

---

## ☕ 1. Cafe, Restoran & Kuliner (F&B)

### Skema SaCMS MCP
* **Content Type `menu-items`:**
  * `name` (text, required), `slug` (text, required, unique)
  * `price` (currency, required, options: `{ "currencyCode": "IDR" }`)
  * `discountPrice` (currency, options: `{ "currencyCode": "IDR" }`)
  * `category` (text, required) — e.g. "Signature Coffee", "Manual Brew", "Main Course", "Pastry & Dessert"
  * `excerpt` (textarea, required) — Deskripsi rasa, komposisi biji kopi (misal: "Arabika Wamena Full Wash")
  * `image` (media, required), `isRecommended` (boolean), `isSpicy` (boolean)
* **Single Type `restaurant-profile`:**
  * `restaurantName`, `tagline`, `aboutStory`, `whatsappReservation`, `address`, `operatingHours`, `instagram`, `mapsUrl`

### Fitur UI Khusus (v0-Grade)
* Filter kategori menu instan (Kopi, Makanan, Cemilan).
* Badge rasa: "Best Seller", "100% Single Origin", "Chef's Recommendation".
* Tombol "Reservasi Meja" & "Pesan Antar via WhatsApp".
* Jam buka interaktif dengan indikator status live ("Buka Sekarang" / "Tutup").

---

## 🏥 2. Klinik, Dokter Gigi & Kesehatan (Medical)

### Skema SaCMS MCP
* **Content Type `services` (Layanan Medis):**
  * `name` (text, required), `slug` (text, required, unique)
  * `priceStartingFrom` (currency, options: `{ "currencyCode": "IDR" }`)
  * `duration` (text) — e.g. "45 - 60 Menit"
  * `description` (richText, required)
  * `icon` (icon), `image` (media)
* **Content Type `doctors` (Tim Dokter / Tenaga Medis):**
  * `name` (text, required) — e.g. "drg. Sarah Anindita, Sp.KG"
  * `specialty` (text, required) — e.g. "Spesialis Konservasi Gigi"
  * `sipNumber` (text) — Nomor izin praktik
  * `schedule` (text) — e.g. "Senin, Rabu, Jumat: 16.00 - 20.00 WIB"
  * `photo` (media, required)
* **Single Type `clinic-profile`:**
  * `clinicName`, `whatsappBooking`, `emergencyPhone`, `address`, `facilityTourVideoUrl`, `operatingHours`, `bpjsSupported` (boolean)

### Fitur UI Khusus (v0-Grade)
* Palet warna *Clean Medical Teal* & *Crisp Cyan* dengan nuansa steril, tenang, dan higienis.
* Modal formulir booking janji temu dokter langsung terhubung ke WhatsApp pendaftaran klinik.
* Bagian profil dokter lengkap dengan jadwal praktik dan nomor SIP.
* Tanda jaminan protokol sterilisasi alat medis.

---

## 🚗 3. Rental Mobil, Transportasi & Jasa (Booking & Services)

### Skema SaCMS MCP
* **Content Type `fleets` (Armada Kendaraan):**
  * `name` (text, required) — e.g. "Toyota Innova Zenix Hybrid", "Mitsubishi Pajero Sport Dakar"
  * `slug` (text, required, unique)
  * `transmission` (select, choices: `["Automatic", "Manual"]`)
  * `capacity` (number) — e.g. 7 kursi
  * `priceWithDriver` (currency, required)
  * `priceSelfDrive` (currency)
  * `features` (tags) — e.g. `["AC Double Blower", "Audio Bluetooth", "Termasuk BBM", "Air Mineral"]`
  * `image` (media, required)
  * `isAvailable` (boolean)
* **Single Type `rental-profile`:**
  * `companyName`, `whatsappOrder`, `termsAndConditions` (richText), `operatingAreas`, `address`

### Fitur UI Khusus (v0-Grade)
* Filter transmisi (Matic / Manual) dan kapasitas penumpang.
* Kalkulator estimasi sewa harian/mingguan.
* Tombol booking instan dengan format pesan otomatis mencantumkan nama armada, tanggal sewa, dan opsi dengan/tanpa supir.

---

## 🏢 4. Profil Perusahaan & Agensi Digital (B2B & Corporate)

### Skema SaCMS MCP
* **Content Type `portfolio` (Studi Kasus / Proyek):**
  * `title` (text, required), `client` (text), `category` (text), `year` (number)
  * `impactMetrics` (text) — e.g. "+240% Peningkatan Konversi"
  * `thumbnail` (media, required), `liveUrl` (url)
* **Content Type `services` (Solusi Bisnis):**
  * `title` (text, required), `slug` (text, required), `excerpt` (textarea), `details` (richText), `icon` (icon)
* **Single Type `company-profile`:**
  * `companyName`, `visionMission` (richText), `awards` (richText), `officeLocation`, `whatsappConsultation`, `email`

### Fitur UI Khusus (v0-Grade)
* Desain *Sleek Minimalist Dark* dengan glassmorphism dan border gradasi halus.
* Bar metrik pencapaian (Proyek Selesai, Klien Aktif, Tahun Pengalaman).
* Showcase portfolio dengan filter kategori dan modal studi kasus detail.

---

## 🏛️ 5. Pemerintahan, OPD & Portal Publik (Government & Public Info)

### Skema SaCMS MCP
* **Content Type `articles` (Berita & Rilis Resmi):**
  * `title` (text, required), `slug` (text, required, unique), `content` (richText, required)
  * `category` (text, required), `coverImage` (media, required), `publishedAt` (datetime, required), `author` (text)
* **Content Type `announcements` (Pengumuman & Edaran):**
  * `title` (text, required), `documentUrl` (file), `isUrgent` (boolean), `publishedAt` (date)
* **Content Type `organizations` (Daftar Dinas & Badan OPD):**
  * `name` (text, required), `headOfOffice` (text), `address` (text), `contactPhone` (phone)
* **Single Type `portal-settings`:**
  * `portalName`, `governmentRegencyName`, `welcomeAddressLeader` (richText), `leaderPhoto` (media), `hotlineEmergency` (phone)

### Fitur UI Khusus (v0-Grade)
* Desain berwibawa: *Government Emerald Green* atau *Deep Navy Blue* dengan lambang resmi.
* Widget pencarian rilis berita publik dan unduhan dokumen PDF surat edaran.
* Widget jam dinas, kontak darurat daerah, dan agenda bupati/kepala dinas.
