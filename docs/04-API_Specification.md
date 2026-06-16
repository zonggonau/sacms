# 📖 SACMS Public API Reference (v1.0)

Dokumentasi ini menjelaskan cara menggunakan Public API SACMS untuk mengambil dan mengelola konten dengan fitur penyaringan tingkat lanjut, ekspansi relasi, pencarian teks lengkap, dan dukungan multi-bahasa.

## 🔑 Autentikasi
Semua permintaan harus menyertakan header Authorization:
`Authorization: Bearer <YOUR_API_TOKEN>`

---

## 🔍 REST API: Filtering & Querying
Endpoint: `GET /api/public/[tenant]/content/[contentType]`

### 1. Filtering (Strapi-style)
Gunakan parameter `filters` untuk menyaring data berdasarkan field di dalam JSON `data`.

**Operator yang didukung:**
- `$eq`: Equal (Sama dengan)
- `$ne`: Not equal
- `$lt`, `$lte`: Less than (or equal)
- `$gt`, `$gte`: Greater than (or equal)
- `$contains`: Case-insensitive search
- `$in`, `$notIn`: Array of values (pisahkan dengan koma)
- `$null`, `$notNull`: Check for null values

**Contoh:**
- Cari artikel dengan harga di atas 50.000:
  `?filters[price][$gte]=50000`
- Cari artikel yang judulnya mengandung kata "Nextjs":
  `?filters[title][$contains]=nextjs`
- Filter dengan logika OR:
  `?filters[$or][0][category][$eq]=tech&filters[$or][1][featured][$eq]=true`

### 2. Relation Population
Secara default, field relasi hanya akan mengembalikan ID. Gunakan `populate` untuk menarik data lengkap.

- Populasikan field tertentu: `?populate=author,category`
- Populasikan semua relasi tingkat pertama: `?populate=*`

### 3. Full-Text Search
Pencarian teks lengkap yang dioptimalkan dengan PostgreSQL GIN Index.
`?search=kata kunci pencarian`

### 4. Localization (i18n)
Ambil konten dalam bahasa spesifik.
`?locale=id` (Default: `en`)

### 5. Sorting & Pagination
- Urutkan berdasarkan field: `?sort=price:desc` atau `?sort=createdAt:asc`
- Pagitnasi: `?page=1&pageSize=10`

---

## 🧬 GraphQL API
Endpoint: `POST /api/public/[tenant]/graphql`

### 1. Query Collection
```graphql
query {
  articles(page: 1, limit: 5, sort: "createdAt", order: "desc") {
    data {
      id
      title
      slug
      content
    }
    meta {
      total
      totalPages
    }
  }
}
```

### 2. Mutations (Membutuhkan Full-Access Token)
**Create Entry:**
```graphql
mutation {
  createArticle(data: { title: "New Article", slug: "new-article" }, locale: "en") {
    id
    title
  }
}
```

**Update Entry:**
```graphql
mutation {
  updateArticle(id: "ID_ENTRI", data: { title: "Updated Title" }) {
    id
    title
  }
}
```

---

## 🛠️ Pemeliharaan System (FTS)
Jika Anda menambahkan field baru atau ingin melakukan re-index manual pada Full-Text Search, jalankan:
```bash
npx tsx scripts/setup-fts.ts
```
