# User Manual / Panduan Pengguna SaCMS

Dokumen ini ditujukan untuk **Tenant Admin** dan **Content Editor** yang menggunakan antarmuka (UI) Dashboard SaCMS.

## 1. Memulai (Getting Started)
1. Buka URL Dashboard: `https://[your-domain.com]/login`.
2. Masukkan kredensial email dan password (atau login via Google/GitHub).
3. Setelah masuk, Anda akan diarahkan ke layar **Workspace / Tenant Selection**. Pilih Workspace Anda.

## 2. Content Builder (Membuat Struktur Tabel)
Untuk mulai menyimpan data, Anda harus membuat struktur (Schema) terlebih dahulu:
1. Buka menu **Content Builder** di sidebar kiri.
2. Klik **Create New Collection Type** (misal: `Articles`).
3. Tambahkan field-field yang dibutuhkan:
   - *Title* (Text, Required)
   - *Content* (RichText)
   - *Cover Image* (Media)
   - *Published Date* (Date)
4. Klik **Save**. Sistem akan secara otomatis membuatkan API Endpoint untuk `Articles`.

## 3. Content Manager (Mengisi Data)
1. Buka menu **Content Manager**.
2. Pilih tipe konten yang tadi dibuat (`Articles`).
3. Klik **Create New Entry**.
4. Isi data sesuai formulir. Anda juga dapat mengunggah gambar langsung dengan memilih field Media.
5. Klik **Save as Draft**.
6. Gunakan tombol **Send to Review** atau **Publish** (jika Anda memiliki hak akses) untuk mempublikasikan konten tersebut ke API Publik.

## 4. Media Library
1. Buka menu **Media Library**.
2. Anda bisa *drag and drop* gambar, video, atau dokumen PDF.
3. Semua gambar yang diunggah akan secara otomatis di-compress dan dibuatkan versi *Thumbnail* dan *Medium* oleh sistem.
4. Anda dapat membuat *Folder* untuk merapikan aset.

## 5. Mengundang Anggota Tim (Team Management)
1. Pergi ke **Settings > Team**.
2. Klik **Invite Member**.
3. Masukkan email anggota dan pilih rolenya (Admin, Editor, atau Member).
4. Anggota akan menerima email undangan.
