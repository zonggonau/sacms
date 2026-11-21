# Alur agen Website Template SaCMS Global

Gunakan alur ini untuk membangun Website Template dan pratinjau di workspace demo internal. Permintaan analisis saja mencakup tahap baca dan rekomendasi. Permintaan membangun demo mencakup pembuatan workspace internal dan pratinjau sesuai brief.

## 1. Analisis sistem dan bagi pekerjaan

Baca `get_builder_guide`, lalu cek `list_website_templates` dan `list_schema_templates` untuk mencari target yang sudah ada. Ringkas tujuan, audiens, alur pengguna, rute prioritas, data publik dan privat, serta siapa yang akan menyunting konten. Jadikan perilaku yang bisa diperiksa sebagai kriteria penerimaan. Catat asumsi yang memengaruhi hasil dan minta keputusan jika pilihannya mengubah ruang lingkup secara signifikan.

Satu koordinator mengurus target, keputusan, dan penulisan lewat Global MCP. Jika subagen tersedia dan diizinkan, bagikan pekerjaan dengan input dan keluaran yang jelas. Agen tunggal menjalankan tanggung jawab yang sama secara bertahap.

| Pekerjaan | Keluaran untuk koordinator |
| --- | --- |
| Analisis dan perencanaan | Brief, rute prioritas, editor dan hak aksesnya, serta kriteria penerimaan |
| Skema dan data SaCMS | Inventaris skema yang dimuat, pemetaan rute ke model, dampak relasi, dan data contoh sintetis |
| UI/UX | Navigasi, kerangka halaman, hierarki, token tema, serta keadaan kosong, memuat, dan gagal |
| Frontend | Implementasi, pemetaan fetch ke field SaCMS, dan hasil verifikasi lokal |
| Keamanan dan rilis | Temuan defensif, perbaikan, hasil dry run, identitas deployment, dan bukti verifikasi rute |

UI/UX dapat mengeksplorasi tata letak dari brief sambil skema demo diperiksa. Implementasi frontend memakai kontrak skema yang telah diverifikasi. Berikan tanggung jawab berkas yang berbeda jika ada beberapa pelaksana. Koordinator mengendalikan versi skema, workspace demo, dan deployment.

## 2. Siapkan workspace demo setelah analisis brief

1. Untuk template yang sudah ada, temukan Schema Template yang terkait. Gunakan kembali demo yang sesuai dengan proyek dan periksa ID-nya dengan `get_schema_template`. Cocokkan target dengan brief dan identitas template.
2. Untuk website baru, panggil `create_schema_template` dengan nama dan kategori, tanpa `schema`, sesudah analisis brief. Gunakan `published: false`. Panggilan ini memuat starter Content Type, Single Type, dan Component ke workspace demo. Simpan ID template, ID demo, dan tautan `demoWorkspace.cmsPath`. Jika respons hilang, cek katalog untuk menemukan hasil panggilan sebelum mengulang.
3. Panggil `get_schema_template` dengan `includeDemoSchema: true`. Pastikan respons memiliki `demoWorkspace.schema` yang berisi model aktual. `schema` pada level template adalah sumber perubahan, termasuk `dummyData`. `demoWorkspace.schema` membuktikan apa yang tersedia di workspace.
4. Periksa kontrak tool server yang sedang terhubung. Jika pembuatan masih mewajibkan `schema`, pembacaan skema aktual belum tersedia, atau template lama belum memiliki demo, laporkan kondisi spesifiknya. Selesaikan analisis yang memungkinkan. Syarat melanjutkan implementasi adalah workspace dan skema aktual yang dapat diverifikasi.

## 3. Cocokkan skema dan data

Baca `list_field_types` dan `contentApiContract`. Petakan setiap rute ke model, slug field, tipe, dan relasi aktual. Gunakan Site Settings untuk identitas dan navigasi bersama, Single Type untuk halaman tunggal, Content Type untuk koleksi, serta Component untuk blok tertanam. Gunakan `list_global_components` dan `get_global_component` jika memerlukan blok tambahan. Pertahankan slug yang sudah digunakan. Pakai tipe field asli untuk SEO, media, dan relasi.

Mulai dari bundel `schema` template, termasuk kelompok dan `dummyData`. Pertahankan semua Single Type dan Component. Keluarkan hanya Content Type yang tidak dibutuhkan. Untuk portal berita, Post dan Kategori biasanya dipakai, sedangkan koleksi Halaman mengikuti sitemap. Jika Post tetap dipakai, pertahankan target relasi Kategori atau sesuaikan relasinya sebelum mengeluarkan Kategori. Periksa referensi dan opsi blok sebelum menyimpan.

- **Schema Template yang belum terhubung ke Website Template.** Simpan lewat `update_schema_template` dengan `expectedVersion` dari `sourceVersion` terbaru. Baca ulang `includeDemoSchema: true` untuk memverifikasi field dan relasi sebelum membangun frontend.
- **Website Template yang sudah terhubung.** Mulai dari skema aktual demo. Jika ada perubahan skema, validasi dulu bundel usulan lewat `update_website_template` dengan `schema` dan `dryRun: true`. Gunakan usulan yang lulus sebagai kontrak frontend. Kirim skema dan patch frontend bersama saat rilis demo, lalu baca ulang skema aktual. Gunakan `expectedVersion` dari Website Template untuk perubahan melalui tool ini.

Pada `CONFLICT`, baca versi baru dan rekonsiliasi perubahan. Pada `HAS_DEPENDENTS`, identifikasi dampak dan dapatkan persetujuan untuk perubahan bersama atau gunakan skema lain yang sah. Laporkan jika definisi yang diminta dan baris aktual masih berbeda.

Baca nilai aktual dengan `get_demo_single_type_entry` atau `list_demo_content_entries`. Untuk singleton, bandingkan `data` dan `publishedData` pada locale yang sama. Jika nilai terbit sudah benar dan frontend kosong, periksa pemetaan field serta rendering.

Gunakan data contoh sintetis sesuai topik. Unggah gambar lewat `upload_demo_media`, lalu pakai ID media hasil unggahan pada field logo atau media. Gunakan `update_demo_single_type_entry` dan `save_demo_content_entry` untuk mengisi nilai demo. Field Component menerima objek atau array sesuai opsi `repeatable`. Setiap blok Repeater membawa slug `__component`. Publikasikan draf demo sesuai kebutuhan pratinjau dan baca ulang nilai terbitnya.

## 4. Bangun dan uji UI/frontend

Gunakan Next.js App Router, TypeScript, Tailwind CSS, dan shadcn/ui. Periksa `components.json` dan komponen lokal pada proyek yang ada. Pilih varian dan token semantik shadcn. Rancang navigasi dan tampilan seluler serta desktop berdasarkan pembaca situs. Uji label form, fokus keyboard, keadaan kosong, kegagalan API, dan 404 yang relevan.

Hubungkan koleksi, halaman tunggal, dan relasi sesuai kontrak Content API. Ambil field yang diperlukan dan lakukan akses konten privat di server. Siapkan `package.json` dan `.env.example` dengan nilai contoh aman. Jalankan lint, typecheck, tes yang relevan, serta build. Catat pemeriksaan yang terhalang lingkungan.

## 5. Pemeriksaan keamanan defensif

Gunakan review kode dan data uji sintetis untuk memastikan kontrol berikut sebelum deploy.

- Simpan `SACMS_API_KEY`, token Global MCP, dan kredensial deploy di sisi server. Gunakan `NEXT_PUBLIC_*` untuk nilai publik seperti URL API dan slug tenant. Periksa bundel, log, console, dan `.env.example` untuk paparan rahasia.
- Gunakan izin minimum dan batasi akses data pada workspace, pengguna, serta status publikasi yang benar. Periksa otorisasi di server untuk operasi tulis dan halaman privat. Pastikan cache data privat mengikuti batas pengguna dan tenant.
- Validasi input dan parameter di server. Bersihkan HTML Rich Text sebelum rendering, gunakan renderer Markdown yang sesuai, serta batasi URL dan sumber aset yang diterima. Perlakukan URL pratinjau sebagai URL publik meski template berstatus `published: false` di katalog. Pakai data sintetis yang bebas dari informasi pribadi dan data pelanggan.
- Untuk form dan endpoint yang dibutuhkan, tinjau hak akses, validasi payload, perlindungan dari pengiriman berulang, dan pesan kesalahan. Tinjau dependensi baru. Perbaiki temuan yang memengaruhi rilis sebelum deploy.

## 6. Deploy dan verifikasi demo

1. Jalankan `create_website_template` dengan `schemaTemplateId` yang telah diverifikasi dan `dryRun: true`. Untuk template yang sudah ada, gunakan `update_website_template` dengan patch `changedFiles`, `expectedVersion` yang sesuai, dan dry run. Selesaikan masalah validasi sambil mempertahankan target yang sama.
2. Simpan rilis pratinjau pada target itu. Deploy pertama mengisi model kosong dari data contoh. Redeploy mempertahankan entri demo. Untuk mengganti isi demo dengan data contoh, gunakan `reset_demo_content` dengan konfirmasi pengguna. Penghapusan Content Type yang berisi entri juga memerlukan konfirmasi terpisah. Gunakan kembali `idempotencyKey` yang sama jika respons create hilang. Gunakan `published: true` hanya jika pengguna mengizinkan publikasi katalog. Untuk pemasangan di workspace pelanggan yang diotorisasi, verifikasi target dan persyaratan `apply_website_template` pada MCP per-workspace.
3. Cocokkan `demoDeployment.verified` atau `get_website_template_demo_status` dengan deployment terbaru. Periksa homepage dan rute utama dari brief, termasuk detail yang benar-benar menampilkan data SaCMS. Jika rilis gagal, baca log build atau runtime yang dilaporkan, perbaiki penyebabnya, dan verifikasi ulang.
4. Laporkan URL yang terverifikasi, workspace atau Schema Template yang dipakai, hasil `routes[]` dan rute tambahan yang diuji, serta kendala yang masih ada. Untuk kegagalan build atau runtime, sertakan tahap dan bukti ringkasnya.
