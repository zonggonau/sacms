# SaCMS API Reference

## 1. Authentication
API publik SaCMS membutuhkan **Bearer Token** yang digenerate melalui menu *API Keys* di Dashboard Admin.

**Header:**
```http
Authorization: Bearer cf_your_api_token_here
```

## 2. Base URL
```text
https://[your-domain]/api/public/[tenant_slug]
```

## 3. Content API (REST)

### 3.1. Get Many Entries
Mengambil daftar entri konten berdasarkan Content Type.

**Endpoint:** `GET /content/[contentTypeSlug]`

**Query Parameters:**
- `locale` (opsional): Menentukan bahasa (contoh: `en`, `id`). Default: Bahasa utama tenant.
- `populate` (opsional): Mengambil data relasi (contoh: `populate=author,category` atau `populate=*`).
- `page`, `pageSize` (opsional): Untuk paginasi (Default: page=1, pageSize=10).
- `sort` (opsional): Pengurutan (contoh: `sort=createdAt:desc`).
- `filters` (opsional): Filtering tingkat lanjut bergaya Strapi.

**Contoh Filter:**
```http
GET /content/articles?filters[title][$contains]=Next.js&filters[price][$gt]=10
```
Operator filter yang didukung: `$eq`, `$ne`, `$in`, `$nin`, `$lt`, `$lte`, `$gt`, `$gte`, `$contains`, `$notContains`, `$startsWith`, `$endsWith`.

### 3.2. Get Single Entry
**Endpoint:** `GET /content/[contentTypeSlug]/[documentId]`

### 3.3. Create Entry (Memerlukan Full Access Token)
**Endpoint:** `POST /content/[contentTypeSlug]`

**Body (JSON):**
```json
{
  "locale": "en",
  "status": "DRAFT",
  "data": {
    "title": "My First Post",
    "body": "Hello world!"
  }
}
```

### 3.4. Update Entry
**Endpoint:** `PUT /content/[contentTypeSlug]/[documentId]`

### 3.5. Delete Entry
**Endpoint:** `DELETE /content/[contentTypeSlug]/[documentId]`

## 4. GraphQL API
GraphQL endpoint mendukung kueri yang lebih spesifik agar payload tidak terlalu besar.
**Endpoint:** `POST /graphql`

**Contoh Kueri:**
```graphql
query {
  articles(locale: "en", filter: { category: { eq: "Tech" } }) {
    id
    title
    author {
      name
      email
    }
  }
}
```
