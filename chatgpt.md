Saat user membuat workspace SaCMS, **Single Type `site-settings` langsung tersedia dan sudah berisi satu entri dengan nilai bawaan**. Single Type ini muncul di **Konten → Pengaturan Site**, sehingga user bisa mengganti nama website, logo, favicon, warna, ukuran, dan tampilan header tanpa meminta AI mengedit source code. Website Template, ChatGPT, dan AI Agent membaca pengaturan yang sama.

## 1. Yang otomatis dibuat saat workspace dibuat

| Yang dibuat      | Nilai awal                                                                                              |
| ---------------- | ------------------------------------------------------------------------------------------------------- |
| Single Type      | **Pengaturan Site**, dengan API ID tetap `site-settings`                                                |
| Entri pengaturan | Satu entri per workspace, langsung bisa dibaca oleh template                                            |
| Nama website     | Nama workspace, bisa diubah setelahnya                                                                  |
| Nama brand       | Nama workspace, bisa berbeda dari nama website                                                          |
| Logo dan favicon | Opsional. Header menampilkan nama brand saat logo kosong. Template memakai favicon bawaan bila tersedia |
| Mode tampilan    | `system`, mengikuti preferensi perangkat. User bisa menetapkan `light` atau `dark`                      |
| Palet warna      | Palet terang dan gelap yang siap dipakai                                                                |
| Ukuran awal      | Logo desktop `40 px`, logo HP `32 px`, tinggi minimum header `72 px` di desktop dan `64 px` di HP       |
| Tipografi awal   | Inter, dengan ukuran teks dasar `16 px`                                                                 |
| Tata letak awal  | Lebar konten maksimum `1200 px`, header `sticky`, logo di kiri                                          |

SaCMS membuat skema dan entri bawaan sebagai bagian dari pembuatan workspace, dengan ID yang tetap. Jika proses provisioning dijalankan ulang, SaCMS memakai entri yang sudah ada sehingga pengaturan user tetap tersimpan. Saat Schema Template dipasang, template menggunakan `site-settings` yang sudah tersedia. Workspace lama bisa mendapatkan skema ini lewat migrasi.

## 2. Isi Single Type **Pengaturan Site**

User melihat label yang mudah dipahami di dashboard. AI dan template memakai key yang konsisten di Content API.

| Tab              | Field yang bisa diubah                                                                                                       | Tipe dan perilaku                                                                                                                                                                                                                         |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Identitas**    | `siteName`, `brandName`, `tagline`, `description`                                                                            | Nama website dipakai sebagai judul default. Nama brand ditampilkan di header atau footer sesuai pengaturan. Contohnya **Portal Resmi Pemerintah Kabupaten Intan Jaya** sebagai nama website dan **Pemkab Intan Jaya** sebagai nama brand. |
| **Logo & Ikon**  | `logo`, `logoLight`, `logoDark`, `logoAlt`, `favicon`, `appleTouchIcon`, `defaultShareImage`                                 | Satu logo umum bisa dipakai untuk semua mode. Logo khusus terang atau gelap diprioritaskan jika tersedia. Favicon dan gambar berbagi dikelola terpisah.                                                                                   |
| **Ukuran Logo**  | `logoHeightDesktop`, `logoHeightMobile`, `logoMaxWidth`, `footerLogoHeight`                                                  | Input angka dalam piksel dengan pratinjau. Rasio gambar dipertahankan dan lebar maksimum mencegah logo terlalu lebar di HP.                                                                                                               |
| **Mode & Warna** | `defaultColorMode`, `showColorModeToggle`, `lightPalette`, `darkPalette`                                                     | Pilih **Terang**, **Gelap**, atau **Ikuti Perangkat**. Admin bisa mengaktifkan tombol ganti mode bagi pengunjung. Setiap mode memiliki paletnya sendiri.                                                                                  |
| **Tipografi**    | `headingFont`, `bodyFont`, `baseFontSize`, `headingScale`, `lineHeight`                                                      | Pilih font dari daftar yang didukung dan atur ukuran dasar, skala judul, serta jarak baris. Pratinjau menunjukkan judul, paragraf, dan tombol.                                                                                            |
| **Tata Letak**   | `containerMaxWidth`, `pagePaddingDesktop`, `pagePaddingMobile`, `sectionSpacing`, `borderRadius`                             | Atur lebar konten, jarak dari tepi layar, jarak antarbagian, dan sudut komponen.                                                                                                                                                          |
| **Header**       | `headerPosition`, `headerHeightDesktop`, `headerHeightMobile`, `brandPlacement`, `showBrandName`, `showTopBar`, `showSearch` | Posisi header bisa `static`, `sticky`, atau `fixed`. Penempatan brand, pencarian, dan bilah atas mengikuti opsi yang didukung template.                                                                                                   |
| **Footer**       | `showFooterLogo`, `showFooterBrand`, `footerLayout`, `footerText`, `copyrightText`, `showSocialLinks`                        | Atur logo, nama brand, teks, tata letak footer, dan visibilitas tautan sosial.                                                                                                                                                            |
| **Komponen**     | `buttonStyle`, `cardStyle`, `buttonRadius`, `cardRadius`, `imageRadius`                                                      | Gunakan pilihan visual yang didukung template. Contohnya kartu `bordered` atau `elevated` dan tombol dengan sudut `8 px`.                                                                                                                 |

### Palet terang dan gelap

Beri nama warna sesuai fungsinya. Saat user mengganti **warna utama**, komponen yang memakai peran tersebut ikut berubah, termasuk tombol utama dan item navigasi aktif. Sediakan pasangan warna latar dan teks agar keduanya bisa diperiksa bersama.

| Field               | Dipakai untuk                 | Terang    | Gelap     |
| ------------------- | ----------------------------- | --------- | --------- |
| `background`        | Latar halaman                 | `#FFFFFF` | `#0B1220` |
| `foreground`        | Teks utama                    | `#111827` | `#F8FAFC` |
| `card`              | Latar kartu                   | `#F8FAFC` | `#111827` |
| `cardForeground`    | Teks pada kartu               | `#111827` | `#F8FAFC` |
| `primary`           | Tombol utama dan elemen aktif | `#1D4ED8` | `#93C5FD` |
| `primaryForeground` | Teks pada tombol utama        | `#FFFFFF` | `#0B1220` |
| `mutedForeground`   | Teks sekunder                 | `#475569` | `#CBD5E1` |
| `border`            | Garis pemisah dan batas input | `#64748B` | `#64748B` |
| `ring`              | Indikator fokus keyboard      | `#1D4ED8` | `#93C5FD` |

Di form SaCMS, sediakan **pemilih warna**, input HEX, dan contoh langsung untuk tombol, kartu, serta header. Tambahkan aksi **Salin palet terang ke gelap**, **Reset tab**, dan **Pulihkan pengaturan bawaan**. Jika ada kontras yang kurang pada pasangan warna utama, dashboard menunjukkan field yang perlu diperbaiki.

## 3. Cara Website Template menerapkannya

**Setiap Website Template Next.js + shadcn/ui perlu membaca `site-settings` saat merender website.** Membuat skema saja belum membuat warna, logo, atau ukuran berubah. Template harus menghubungkan masing-masing nilai ke komponen, variabel CSS, dan metadata.

| Sumber pengaturan                                            | Pemakaian di frontend                                                                                                        |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| `siteName`, `description`, `favicon`, `defaultShareImage`    | Metadata Next.js, ikon tab browser, dan gambar berbagi                                                                       |
| `brandName`, `logo`, `logoLight`, `logoDark`                 | Header dan footer. Saat logo khusus mode kosong, gunakan logo umum                                                           |
| `lightPalette` dan `darkPalette`                             | Variabel CSS seperti `--background`, `--foreground`, `--primary`, dan `--primary-foreground` yang dipakai shadcn/ui          |
| `defaultColorMode` dan `showColorModeToggle`                 | Mode awal situs dan kontrol perubahan mode bagi pengunjung                                                                   |
| `logoHeightDesktop`, `logoHeightMobile`, `containerMaxWidth` | Ukuran gambar dan tata letak responsif                                                                                       |
| `headerPosition` dan tinggi header                           | Posisi header. Untuk `fixed`, template menyediakan ruang di atas konten sesuai tinggi header pada masing-masing ukuran layar |

Setiap Website Template sebaiknya mendeklarasikan **opsi yang didukungnya**. Misalnya, template portal berita mendukung tiga gaya header, sedangkan template landing page mendukung dua. Dashboard menampilkan pilihan yang tersedia, dan AI membaca dukungan yang sama sebelum mengubah nilai. Dengan begitu user tidak mendapat pilihan yang tidak punya efek pada website.

## 4. Cara ChatGPT dan AI Agent menggunakannya

Saya sarankan menyediakan tiga operasi MCP khusus, dengan nama berikut sebagai usulan.

| Operasi MCP             | Fungsi                                                                                                                   |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `get_site_settings`     | Membaca pengaturan workspace, nilai bawaan, status draft atau terbit, dan opsi yang didukung oleh Website Template aktif |
| `update_site_settings`  | Memperbarui sebagian field, memvalidasi warna, angka, aset, dan pilihan template, lalu menyimpan draft                   |
| `publish_site_settings` | Menerapkan draft ke website sesuai izin user dan memicu pembaruan data frontend                                          |

Contoh perintah user:

> “Cek pengaturan site workspace ini. Buat tampilannya seperti portal pemerintah. Gunakan biru tua di mode terang dan biru muda di mode gelap. Logo desktop 48 px, logo HP 36 px, dan header fixed. Tampilkan pratinjau dulu.”

Agent membaca `site-settings` dan kemampuan template, mengubah field yang diminta, lalu membuka pratinjau. Jika user meminta bentuk header yang belum didukung, agent dapat menambahkan kemampuan itu ke Website Template dan mendaftarkan opsinya agar perubahan berikutnya bisa dilakukan dari dashboard.

**Untuk rilis pertama SaCMS**, saya akan menetapkan enam hal sebagai standar wajib: **`site-settings` otomatis, identitas dan media, palet terang/gelap, ukuran logo desktop/HP, konfigurasi header, serta integrasi Next.js + shadcn/ui**. Uji penerimaannya sederhana: **buat workspace baru, aktifkan satu Website Template, lalu ubah nama brand, favicon, warna kedua mode, dan ukuran logo dari dashboard atau MCP. Semua perubahan harus terlihat di pratinjau desktop dan HP, lalu tampil di website setelah dipublikasikan.**
