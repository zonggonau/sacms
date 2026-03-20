# Content Types Setup Documentation

## 📋 Overview

Dokumentasi ini menjelaskan cara setup dan menggunakan content types di SACMS.

## 🔧 Setup Content Type "Berita"

### Fields yang Ditambahkan

Content type "berita" sudah memiliki field-field berikut:

| Field | Slug | Type | Required | Description |
|--------|-------|-------|-----------|-------------|
| Judul | title | text | ✅ Yes | Judul berita (unique) |
| Ringkasan | description | textarea | ✅ Yes | Ringkasan singkat berita |
| Isi Konten | content | richText | ✅ Yes | Konten lengkap dengan rich text editor |
| Gambar Cover | cover | media | ❌ No | Gambar cover untuk berita |
| Penulis | author | text | ❌ No | Nama penulis berita |
| Kategori | category | select | ✅ Yes | Kategori berita (Berita, Pengumuman, Artikel, Press Release) |
| Tags | tags | text | ❌ No | Tags untuk berita |
| Status | status | select | ✅ Yes | Status berita (Draft, Published, Archived) |

### Cara Menambahkan Fields

Jika ingin menambahkan fields ke content type yang lain:

```bash
# Edit script dan ganti slug dan field definitions
npx tsx scripts/add-berita-fields.ts
```

### Cara Assign Content Type ke Tenant

```bash
npx tsx scripts/assign-berita-to-tenant.ts
```

## 🌐 URL Structure

### Content Types List
```
http://localhost:3000/dashboard/kominfo/content-types
```
Menampilkan semua content types yang di-assign ke tenant

### Entries List
```
http://localhost:3000/dashboard/kominfo/content-types/berita
```
Menampilkan semua entries untuk content type "berita"

### Create New Entry
```
http://localhost:3000/dashboard/kominfo/content-types/berita/new
```
Form untuk membuat entry baru dengan field-field:
- Judul (text input)
- Ringkasan (textarea)
- Isi Konten (rich text editor)
- Gambar Cover (media uploader)
- Penulis (text input)
- Kategori (dropdown select)
- Tags (text input)
- Status (dropdown select)

### Edit Entry
```
http://localhost:3000/dashboard/kominfo/content-types/berita/edit/[entryId]
```
Form untuk mengedit entry yang ada

## 🧪 Testing Steps

### Test 1: Buka Content Types List
1. Buka: `http://localhost:3000/dashboard/kominfo/content-types`
2. Login dengan user yang memiliki akses ke tenant "kominfo"
3. Anda harus melihat content type "Berita" di table

### Test 2: Buka Entries Berita
1. Dari content types list, klik ikon Database di row "Berita"
2. Harusnya redirect ke: `http://localhost:3000/dashboard/kominfo/content-types/berita`
3. Anda harus melihat:
   - Statistics cards (Total Entries, Published, Drafts)
   - Search box
   - Filter buttons (All, Published, Drafts)
   - Table dengan entries (jika ada)

### Test 3: Buat Entry Baru
1. Klik tombol "New Entry"
2. Harusnya redirect ke: `http://localhost:3000/dashboard/kominfo/content-types/berita/new`
3. Anda harus melihat form dengan field-field:
   - **Judul**: Text input (required)
   - **Ringkasan**: Textarea (required)
   - **Isi Konten**: Rich text editor (required)
   - **Gambar Cover**: Media uploader (optional)
   - **Penulis**: Text input (optional)
   - **Kategori**: Dropdown dengan pilihan (required)
   - **Tags**: Text input (optional)
   - **Status**: Dropdown dengan pilihan (required)

### Test 4: Simpan Entry
1. Isi semua field yang required
2. Klik tombol "Save Draft"
3. Entry harus tersimpan dan redirect kembali ke list
4. Klik tombol "Publish"
5. Entry harus tersimpan dengan status "Published"

### Test 5: Edit Entry
1. Dari entries list, klik ikon Edit (pencil) di row entry
2. Harusnya redirect ke: `http://localhost:3000/dashboard/kominfo/content-types/berita/edit/[id]`
3. Form harus terisi dengan data entry yang ada
4. Ubah beberapa field dan klik "Save Changes"
5. Data harus terupdate

## 🎨 Field Types yang Didukung

Berikut adalah field types yang didukung di SACMS:

| Type | Component | Description | Example |
|-------|-----------|-------------|----------|
| text | TextField | Input teks satu baris | Judul, Penulis |
| textarea | TextField | Input teks multi-baris | Ringkasan |
| richText | RichTextField | Rich text editor dengan formatting | Isi Konten |
| date | DateField | Date picker | Tanggal Publish |
| datetime | DateField | Date & time picker | Tanggal & Waktu |
| boolean | BooleanField | Checkbox/toggle switch | Published, Featured |
| select | SelectField | Dropdown dengan opsi | Kategori, Status |
| media | MediaField | File uploader untuk gambar/media | Cover Image |
| number | TextField | Input angka | Price, Quantity |
| email | TextField | Input email | Email Address |

## 📝 Field Definitions Format

Untuk menambahkan field baru, gunakan format ini:

```typescript
{
  name: 'Nama Field',        // Label yang ditampilkan di form
  slug: 'field_slug',       // Identifier unik (snake_case)
  type: 'text',             // Type field (lihat table di atas)
  required: true,           // Apakah field wajib diisi
  unique: false,             // Apakah nilai harus unik
  options: JSON.stringify([...])  // Opsi untuk type 'select'
  order: 1,                 // Urutan tampilan di form
}
```

## 🔌 API Endpoints

### Get Single Content Type
```
GET /api/tenant/[tenant]/content-types/[contentSlug]
```
Returns content type dengan field definitions

### Get Entries
```
GET /api/tenant/[tenant]/content/[contentSlug]
```
Returns semua entries untuk content type tertentu

### Create Entry
```
POST /api/tenant/[tenant]/content/[contentSlug]
Body: {
  data: { ...fieldValues },
  publish: boolean
}
```

### Update Entry
```
PUT /api/tenant/[tenant]/content/[contentSlug]/[entryId]
Body: {
  data: { ...fieldValues },
  publish: boolean
}
```

### Delete Entry
```
DELETE /api/tenant/[tenant]/content/[contentSlug]/[entryId]
```

## 🎯 Next Steps

1. **Buat Content Type Lain**: Gunakan script serupa untuk content types lain (pengumuman, agenda, dll)
2. **Custom Field Renderers**: Tambahkan field types kustom jika dibutuhkan
3. **Validasi Lanjutan**: Tambahkan validasi field yang lebih kompleks
4. **Media Library**: Implementasi media library untuk upload gambar
5. **Preview Entry**: Tambahkan preview entry sebelum publish

## 📚 Related Documentation

- [Midtrans Integration](./MIDTRANS_INTEGRATION.md)
- [Cron Jobs](../scripts/cron-jobs.md)
- Prisma Schema: `prisma/schema.prisma`