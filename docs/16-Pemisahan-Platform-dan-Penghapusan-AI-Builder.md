# Pemisahan Platform & Penghapusan AI Website Builder

**Tanggal:** 16 September 2026
**Status:** Rencana — menunggu persetujuan pemilik sistem
**Mengubah:** [03-Technical_Design_Document](./03-Technical_Design_Document.md) §2.2,
[04-API_Specification](./04-API_Specification.md), [12-AI_Integration](./12-AI_Integration.md),
[13-White_Label_and_Custom_Domain](./13-White_Label_and_Custom_Domain.md)
**Terkait lintas repo:** `../../RENCANA-PEMISAHAN-PLATFORM.md`,
`sacms-for-user-nocode/docs/adr/ADR-015-backend-data-dari-sacms-developer.md`

---

## 1. PERSONA

Anda adalah **Platform Architect** SaCMS. Tanggung jawab Anda di dokumen ini: menetapkan
batas baru antara SaCMS sebagai *headless CMS untuk developer* dan produk nocode yang
berdiri di atasnya, lalu memastikan penghapusan AI website builder tidak menjatuhkan fitur
lain yang kebetulan menumpang di namespace yang sama.

## 2. CONTEXT

### 2.1 Peran Baru

SaCMS (`sacms-for-developer`) berhenti menjadi *website builder* dan menjadi **data plane**:

| Peran                                     | Untuk siapa                                 |
| ----------------------------------------- | ------------------------------------------- |
| Multi-tenant headless CMS (REST + GraphQL) | Developer, agensi, instansi                 |
| MCP server (44 tool)                       | AI coding agent **dan** produk nocode       |
| Object storage per-tenant (S3/R2)          | Semua konsumen                              |
| Kuota storage per tenant + add-on storage  | Semua pelanggan, termasuk Enterprise        |
| Billing & plan (Midtrans)                  | Semua konsumen                              |

Seluruh siklusnya — perancangan, pengembangan, deploy, live — tetap di **VPS SaCMS**
(`164.68.116.79` / `developer.sacms.cloud`, `/opt/sacms`, Caddy + Docker Compose + GHCR).
Apex `sacms.cloud` bukan lagi milik SaCMS — ia dipakai SaCMS nocode, yang berjalan di VPS yang sama
(nocode ADR-017). Pengelolaan
konten tetap di `cms.sacms.cloud`.
Tidak ada bagian dari aplikasi `sacms-for-developer` yang pindah ke Vercel; yang di Vercel hanya
website pelanggan, termasuk Enterprise (§5.13).

### 2.2 Kenapa AI Website Builder Dihapus

Ia duplikat dari `sacms-for-user-nocode`, yang memang dibangun untuk itu dan hanya untuk itu.
Mempertahankan keduanya berarti dua pipeline v0, dua tempat menyimpan kredit AI, dan dua
tempat memanggil Vercel — dengan hasil yang lebih buruk di sisi CMS karena bukan fokusnya.

Pengguna SaCMS adalah orang yang **menulis kodenya sendiri**. Yang mereka butuhkan dari
platform ini adalah schema, konten, media, API, dan hosting — bukan generator halaman.

### 2.3 Batas Penghapusan

**Dihapus:** AI *website generation* — v0, Claude builder, orkestrator agen, preview
Sandpack, dan model `Site*`.

**Tetap:** AI *content assist* di dalam CMS — `smart-fill`, `translate`, `content-assist`,
`schema-generator-dialog`, `lib/ai.ts`, `lib/ai-schema-generator.ts`, `lib/ai-templates.ts`,
dan `AiQuotaLedger`. Ini fitur CMS yang membantu mengisi dan menerjemahkan entri, bukan
builder.

**Tetap:** `api/tenant/[tenant]/developer/ai-prompt` — namanya mengandung "ai" tetapi isinya
codegen: ia menghasilkan tipe TypeScript dan prompt untuk dipakai di Cursor / Claude Code.
Justru inilah bentuk "AI" yang cocok untuk produk developer. Pertimbangkan mengganti namanya
menjadi `developer/codegen` di kemudian hari.

---

## 3. TASK — Inventaris Penghapusan

Angka baris di bawah dihitung dari kode hari ini (commit `e10371c`, branch `develop`).

### 3.1 Berkas yang Dihapus Seluruhnya

**Pustaka AI builder — 2.478 baris**

| Berkas                                | Baris |
| ------------------------------------- | ----: |
| `src/lib/ai/agent-orchestrator.ts`     |   545 |
| `src/lib/ai/website-generator.ts`      |   504 |
| `src/lib/ai/domain-knowledge-types.ts` |   504 |
| `src/lib/ai/schema-engine.ts`          |   295 |
| `src/lib/ai/model-router.ts`           |   114 |
| `src/lib/ai/domain-knowledge.ts`       |    11 |
| `src/lib/ai/chat-access.ts`            |    25 |
| `src/lib/v0-client.ts`                 |   479 |
| `src/lib/claude-builder-client.ts`     |   144 |

> Setelah ini folder `src/lib/ai/` kosong dan ikut dihapus. Jangan tertukar dengan
> `src/lib/ai.ts` (berkas, bukan folder) yang **tetap**.

**Rute API AI — 1.176 baris**

| Rute                                                           | Baris |
| -------------------------------------------------------------- | ----: |
| `api/ai-builder/global-generate`                                |   292 |
| `api/tenant/[tenant]/ai-builder/generate-frontend`              |   263 |
| `api/tenant/[tenant]/ai-builder/generate`                       |   229 |
| `api/tenant/[tenant]/ai-builder/preview/[chatId]/[[...path]]`   |   166 |
| `api/tenant/[tenant]/ai-builder/iterate`                        |    64 |
| `api/tenant/[tenant]/ai-builder/plan-schema`                    |    56 |
| `api/tenant/[tenant]/ai-builder/delete`                         |    50 |
| `api/tenant/[tenant]/ai-builder/history`                        |    31 |
| `api/tenant/[tenant]/ai-builder/history/[chatId]`               |    25 |

**Rute Site — 490 baris**

Seluruh `api/tenant/[tenant]/sites/**`: `route.ts` (211), `[siteId]/apply-schema` (80),
`[siteId]/chat` (95), `[siteId]/files` (46), `[siteId]/route.ts` (58).

**UI — 2.384 baris**

| Berkas                                                                          | Baris |
| ------------------------------------------------------------------------------- | ----: |
| `.../content-type-builder/aiwebsitebuilder/website-builder-client.tsx`           | 2.101 |
| `.../content-type-builder/aiwebsitebuilder/page.tsx`                             |   101 |
| `.../content-type-builder/aiwebsitebuilder/loading.tsx`                          |    74 |
| `src/components/ai-builder/sandpack-preview.tsx`                                 |   108 |

**Total dihapus: ± 6.528 baris.**

### 3.2 Model Prisma yang Diturunkan

`Site`, `SiteFile`, `SiteVersion`, `SiteDeployment`, `SiteConversation`, `SiteMessage`
(`prisma/schema.prisma` baris 807–908), beserta relasi `sites Site[]` di model `Tenant`.

Migrasi harus **dua langkah**, bukan satu:

```
Migrasi A (deploy dulu)  : hapus relasi di kode, hentikan seluruh penulisan ke tabel sites*
Cadangkan               : pg_dump khusus 6 tabel sites* → simpan di luar VPS
Migrasi B (setelah aman): DROP TABLE site_messages, site_conversations, site_deployments,
                          site_versions, site_files, sites   (urutan ini, karena foreign key)
```

Jangan menggabungkan keduanya. Kalau ada tenant yang ternyata masih punya situs hidup,
langkah A bisa dibalik tanpa kehilangan data.

### 3.3 ⚠️ Yang Harus **Dipindahkan**, Bukan Dihapus

Ini bagian paling mudah salah. Lima rute di bawah **parkir** di namespace `ai-builder/`
tetapi **tidak punya satu pun impor AI**. Menghapusnya bersama yang lain akan merusak panel
hosting dan fitur schema yang dipakai developer.

| Rute lama                                    | Baris | Impornya                         | Rute baru                             |
| -------------------------------------------- | ----: | -------------------------------- | ------------------------------------- |
| `ai-builder/deploy`                           |   466 | `vercel-client`, `hosting-plan`  | `hosting/deploy`                      |
| `ai-builder/export-starter`                   |   336 | `jszip`, `getTenantDb`           | `developer/export-starter`            |
| `ai-builder/import-schema`                    |   116 | `getTenantDb`                    | `schema/import`                       |
| `ai-builder/export-schema`                    |    75 | `getTenantDb`                    | `schema/export`                       |
| `ai-builder/domain`                           |    48 | `vercel-client`                  | `hosting/domain`                      |

**`ai-builder/deploy` adalah yang paling kritis.** Ia dipanggil tiga kali dari
`src/app/(workspace)/dashboard/[tenant]/(dashboard)/infrastructure/hosting-deployments-view.tsx`
(baris 196, 237, 323). Itu panel **Hosting**, bukan panel AI. Pindahkan rutenya, lalu
perbarui ketiga pemanggilan.

`ai-builder/export-starter` juga satu-satunya pemakai `src/lib/starter-kits.ts` selain
`tenant-provisioning.ts` — keduanya tetap.

### 3.4 Suntingan di Berkas yang Tetap Ada

| Berkas                                                        | Yang disunting                                                                                     |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `src/proxy.ts`                                                | Hapus rewrite preview v0 (baris ±123–131) dan cabang `isPreview` (baris ±679)                       |
| `src/components/dashboard/content-builder-sidebar.tsx`        | Hapus item menu `"AI Website Builder"` (baris 27)                                                    |
| `.../infrastructure/hosting-deployments-view.tsx`             | Arahkan 3 fetch ke `hosting/deploy`; hapus tautan ke `aiwebsitebuilder` (baris ±558–560)            |
| `src/app/api/tenant/[tenant]/white-label/domain/route.ts`     | Hapus `db.site.findFirst` (baris 88) dan komentar live-check (baris 130) — ganti sumber cek domain  |
| `src/lib/infrastructure/hosting-plan.ts`                      | Perbarui komentar baris 9 yang menyebut `ai-builder/deploy/route.ts`                                 |
| `src/lib/settings.ts`                                         | Hapus `v0ApiKey` (baris 158, 272)                                                                    |
| `src/app/api/tenants/[tenantId]/route.ts`                     | Hapus blok hapus-chat-v0.dev (langkah 3) + `import { v0 } from "v0"`; rutenya sendiri **tetap**       |
| `src/components/landing/sections/hero-section.tsx`            | Perbarui copy yang menjual AI website builder                                                        |
| `.env.example`, `.env.production.example`                     | Hapus `V0_API_KEY` dan catatan v0.dev di header                                                      |
| `CLAUDE.md`                                                   | Hapus routing skill `/sacms-frontend-builder` bila skill itu ikut dipensiunkan                        |

### 3.5 Dependency yang Bisa Dilepas

Diperiksa dengan grep di seluruh `src/` — tujuh paket ini **tidak dipakai di mana pun**
selain AI builder, dan tiga di antaranya sudah mati bahkan sebelum penghapusan:

| Paket                        | Pemakai hari ini                  |
| ---------------------------- | --------------------------------- |
| `@codesandbox/sandpack-react` | hanya 2 berkas AI builder          |
| `v0-sdk`                      | **tidak ada** (mati)               |
| `@v0-sdk/react`               | **tidak ada** (mati)               |
| `@ai-sdk/openai`              | **tidak ada** (mati)               |
| `@ai-sdk/google`              | **tidak ada** (mati)               |
| `@ai-sdk/react`               | **tidak ada** (mati)               |
| `v0`                          | hanya blok hapus-chat di rute hapus tenant (§3.4) |

`openai` **tetap** — ia dipakai `lib/ai.ts`, `lib/ai-schema-generator.ts`, rute
smart-fill/content-assist, dan halaman admin settings.

### 3.6 Dokumen yang Terpengaruh

- `docs/12-AI_Integration.md` — tulis ulang, sisakan bagian content assist & schema generator.
- `docs/04-API_Specification.md` — buang bagian "AI Schema Builder", perbarui "Starter Exporter"
  ke rute barunya.
- `docs/03-Technical_Design_Document.md` §2.2 — hapus "sandpack preview" dari deskripsi
  Client Component.
- `docs/v0.md`, `aicms.md` — arsipkan.
- `docs/00-README.md` — tambahkan dokumen 16 ini ke indeks.

---

## 4. TASK — Menjadi Data Plane untuk nocode

### 4.1 Jalur yang Dipakai nocode

```
sacms-for-user-nocode (VPS yang sama, jaringan Docker `sacms_default`)
  │
  ├─ MCP  /api/mcp                    Bearer <ApiToken tenant>
  │     create_content_type · update_content_type · delete_content_type
  │     create_single_type · update_single_type · update_single_type_content
  │     create_component · update_component · delete_component
  │     create_content_entry · update_content_entry · query_content
  │     get_full_schema · list_field_types
  │
  ├─ REST /api/public/[tenant]/content/[contentType]     baca konten untuk website
  │  GQL  /api/public/[tenant]/graphql
  │
  ├─ Media /api/tenant/[tenant]/media/upload             aset pengguna
  │        /api/media/serve · /api/media/transform
  │
  └─ PostgreSQL 17 @ VPS               database terpisah `sacms_nocode`
        lewat jaringan Docker, bukan lewat MCP
```

MCP dipakai untuk **schema dan konten website pengguna**. Tabel operasional nocode
(`BuildJob`, `BuildStep`, `Deployment`, `CreditLot`, `UsageEvent`) **tidak** lewat MCP —
halaman builder melakukan polling tiap 2 detik dan itu jalur terpanas aplikasi.

### 4.2 Yang Sudah Siap Dipakai

Tidak perlu dibangun ulang — sudah ada dan berjalan:

- MCP server `src/app/api/mcp/[[...transport]]/route.ts` (2.951 baris, 44 tool, v2.2.0),
  Streamable HTTP, auth Bearer `ApiToken`/`ApiKey`, rate limit per tenant.
- REST + GraphQL publik per-tenant, lengkap dengan `openapi.json` per tenant.
- Storage S3-compatible: `src/lib/r2.ts`, kunci per tenant, penyajian lewat `/api/media/serve`
  dan transformasi lewat `/api/media/transform`.
- Penghitungan pemakaian storage per tenant dan add-on storage (`src/lib/plan-enforcement.ts`) —
  dengan celah yang harus ditutup (§5.13).
- SDK TypeScript `@sacms/sdk` di `mini-services/sdk/`.

---

## 5. TASK — Provisioning Tenant untuk nocode (BARU)

### 5.1 Model yang Diputuskan Pemilik

Pengguna nocode **tidak punya akun di SaCMS**. Seluruh tenant yang lahir dari nocode dibuat
oleh **satu akun layanan** milik pemilik sistem, berperan `super_admin`, dan dikelola
pemilik sistem dari dashboard ini.

```
Pengguna nocode  ──(tidak punya akun di SaCMS)──✗

SATU PROJECT nocode = SATU TENANT

nocode  ──POST /api/platform/tenants──►  SaCMS
                                          │
                                          ├─ Tenant (source: "nocode")
                                          ├─ TenantMember { userId: AKUN LAYANAN, role: "owner" }
                                          ├─ ApiToken (full-access) ──► dikembalikan ke nocode
                                          └─ provisionTenant() — starter kit

Pemetaan project nocode → tenant disimpan di database nocode, bukan di sini.
```

Alasannya sudah benar: membuat workspace **wajib** punya akun SaCMS, dan tiap akun punya
batas jumlah workspace. Dengan satu akun layanan berperan `super_admin`, batas itu hilang
sama sekali (§5.3), dan tidak ada ribuan akun bayangan yang harus dibuat dan dirawat.

### 5.2 Masalahnya Hari Ini

Dua hal, keduanya diperiksa di kode:

**`POST /api/tenants` menuntut sesi manusia.** Ia memanggil
`getServerSession(authOptions)` — tanpa sesi, 401.

**MCP tidak bisa membuat tenant pertama.** `resolveToken` mengembalikan `AuthContext` yang
**sudah berisi `tenantId`**, karena `ApiToken` dan `ApiKey` keduanya terikat ke satu tenant.
Ayam dan telur.

### 5.3 Akun Layanan Berperan `super_admin`

Akun layanan memakai `User.role = "super_admin"`. Alasannya langsung dan benar:
`enforceUserPlanLimit` memeriksa role itu **sebelum** menghitung apa pun, lalu keluar lebih
awal:

```ts
if (user?.role === "super_admin") {
  return { allowed: true, current: ..., max: 999999, planSlug: "custom",
           message: "Super Admin Bypass" }
}
```

Dengan begitu batas jumlah workspace hilang sepenuhnya, dan `getUserUsage` — yang
menjalankan `tenantMember.count()` dan makin lambat seiring tumbuhnya tenant — **tidak
pernah dipanggil sama sekali**. Dua masalah selesai dengan satu keputusan.

Tidak perlu menambah role baru. Nilai `User.role` yang ada hari ini (`super_admin`, `admin`,
`owner`, `user`, `author`, `contributor`) sudah cukup.

#### Yang membuat ini aman: akun layanan tidak boleh bisa login

Pemeriksaan di kode menunjukkan bahwa kekuasaan `super_admin` **seluruhnya melekat pada
sesi**, bukan pada akunnya:

| Temuan                                                                                  | Artinya                                                                      |
| ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| 76 berkas memeriksa `session.user.role === "super_admin"`                                 | Semua butuh **sesi interaktif**. Tanpa sesi, tidak satu pun aktif.            |
| MCP `resolveToken` menetapkan `isSuperAdmin: false` tanpa syarat (baris 146)              | ApiToken hasil provisioning **tidak** mewarisi kekuasaan super admin.        |
| `hasScope()` hanya melonggar lewat `isSuperAdmin` atau `full_access`                     | Jalur MCP tetap dibatasi izin token, bukan role akun.                        |
| `authorize()` menolak dengan `if (!user \|\| !user.password) return null` (`auth.ts:133`) | Akun ber-`password: null` **tidak bisa login** lewat kredensial.             |
| Login OAuth menuntut baris `Account` yang tertaut                                         | Tanpa baris itu, tidak ada jalur masuk Google/OAuth.                          |
| `enforceUserPlanLimit` membaca role lewat `db.user.findUnique`, bukan sesi                | Bypass limit **tetap berfungsi** untuk panggilan mesin. Inilah yang kita mau. |

Kesimpulannya: **`super_admin` tanpa jalur login = persis satu kemampuan, yaitu bypass batas
plan.** Selebihnya mati karena tidak ada sesi yang bisa dibuat.

Karena itu tiga syarat berikut bukan saran, melainkan bagian dari keputusan ini:

1. **`password` wajib `null`.** Jangan pernah diisi, termasuk "sementara untuk mengetes".
2. **Tidak ada baris `Account`** yang tertaut ke akun itu — tidak ada Google, tidak ada OAuth.
3. **`emailVerified` diisi** saat dibuat, dan emailnya memakai alamat yang tidak bisa menerima
   surat (mis. `svc-nocode@sacms.internal`), supaya alur "lupa kata sandi" tidak punya pintu.

Satu uji di CI menjaga ketiganya tetap benar:

```
Akun layanan: password IS NULL, tidak punya baris Account, dan
percobaan login dengan kata sandi apa pun mengembalikan null.
```

> **Di mana risikonya benar-benar ada.** Bukan pada hari akun ini dibuat, melainkan pada hari
> seseorang mengisi `password`-nya untuk keperluan darurat. Sejak detik itu akun mesin
> berubah menjadi admin penuh atas seluruh platform. Uji CI di atas adalah yang menahan hal
> itu, jadi jangan diberi pengecualian.

### 5.4 Batas Workspace — Selesai, dengan Satu Sisa

Bypass `super_admin` menyelesaikan masalah batas workspace sepenuhnya. Tidak perlu
`CustomPlanOverride`, tidak perlu mengubah `getUserUsage`.

Yang **tidak** ikut selesai, dan tetap harus dikerjakan:

| Sisa                                                                                        | Kenapa masih perlu                                                                                    |
| --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Kolom `source` dan `externalRef` di `Tenant`                                                   | Untuk idempotensi, penyaringan, audit, dan pelaporan. Tidak ada hubungannya dengan limit.               |
| Filter `source` di `GET /api/tenants` dan dashboard pemilik                                    | Daftar workspace tetap akan dibanjiri tenant nocode (§5.6).                                             |
| Batas jumlah website per pengguna                                                              | Ditegakkan **di nocode** oleh `quota.service` dan `WebsiteSubscription`. SaCMS tidak lagi membatasi apa pun di jalur ini. |
| Penanda `source: "nocode"` pada `AuditLog`                                                     | Tanpa itu, ribuan aksi akan tercatat atas nama satu akun super admin dan tidak bisa dibedakan dari aksi manusia. |

Butir terakhir yang paling mudah terlewat: begitu akun layanan berperan `super_admin`, log
audit kehilangan kemampuan membedakan "pemilik sistem melakukan sesuatu" dari "mesin
membuat tenant". Penanda `source` mengembalikan kemampuan itu.

### 5.5 Kontrak Endpoint

```http
POST /api/platform/tenants
Authorization: Bearer <PLATFORM_PROVISION_KEY>
Idempotency-Key: <externalRef>
Content-Type: application/json

{
  "externalRef":  "nocode:prj_01H...",   // satu project = satu tenant
  "name":         "Koperasi Merah Putih",
  "plan":         "free",
  "websiteType":  "umkm",
  "source":       "nocode"
}
```

```json
{
  "tenantId": "clx...",
  "tenantSlug": "koperasi-merah-putih-a1b2",
  "apiToken": "cf_...",
  "mcpUrl": "https://developer.sacms.cloud/api/mcp",
  "apiBaseUrl": "https://developer.sacms.cloud/api/public/koperasi-merah-putih-a1b2"
}
```

**Gunakan ulang isi `POST /api/tenants`, jangan tulis ulang.** Transaksi yang ada sudah
melakukan persis yang dibutuhkan — yang berubah hanya sumber `userId`:

| Langkah di transaksi yang ada                                     | Untuk jalur nocode                                                                  |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `generateUniqueSlug()`                                             | Tetap — tidak ada tabrakan slug                                                      |
| `tenant.create({ status: "provisioning" })`                        | Tetap, **+ `source: "nocode"`, `externalRef`, `ownerId`, `plan: "nocode"`, `hostingStatus: "active"`** (§5.11) |
| `tenantMember.create({ userId: session.user.id, role: "owner" })`  | `userId` = **ID akun layanan**                                                       |
| `subscription.create({ userId: session.user.id, ... })`            | **Dilewati** (§5.6); gerbang MCP dipenuhi lewat `hostingStatus: "active"`           |
| `apiToken.create({ type: "full-access" })`                         | Tetap; token plain dikembalikan ke nocode **satu kali**                              |
| `provisionTenant(tenant.id, aiPrompt, websiteType)`                | Tetap — **tidak bergantung AI**, memakai `STARTER_KITS` statis dan template dari DB   |
| `logAudit({ action: TENANT_CREATED })`                             | Tetap, **+ `source: "nocode"`**                                                       |

Syarat yang tidak bisa ditawar:

1. **Kunci tingkat platform.** `PLATFORM_PROVISION_KEY` di-hash SHA-256 di database seperti
   `ApiToken` ([09-Security_Policy](./09-Security_Policy.md)), bisa dirotasi tanpa deploy.
2. **Idempoten.** `externalRef` unik. Retry mengembalikan tenant yang sama beserta tokennya,
   bukan tenant kedua.
3. **Rate limit terpisah** dari rate limit tenant — endpoint ini membuat sumber daya.
4. **Membuat dan menghapus.** Penghapusan punya kontrak dan pagarnya sendiri — lihat §5.9.
5. **Kolom baru di `Tenant`:** `source String?` dan `externalRef String? @unique`.
   Tanpa keduanya, tenant nocode tidak bisa dibedakan, disaring, atau dihitung terpisah —
   dan §5.4 jalan A menjadi mustahil.

### 5.6 Tiga Efek Samping yang Harus Diputuskan

Ketiganya lahir dari "semua tenant di bawah satu akun", dan ketiganya terasa dalam hitungan
minggu, bukan tahun.

**`Subscription` menumpuk di akun layanan.** Transaksi yang ada membuat satu baris
`Subscription` dengan `userId` pembuatnya. Untuk jalur nocode itu berarti ribuan baris
langganan atas nama satu akun. Pilihannya: lewati pembuatan `Subscription` untuk
`source = "nocode"` dan biarkan penagihan sepenuhnya di nocode (yang sudah punya
`WebsiteSubscription` dan `CreditLot` sendiri), atau tetap buat dengan penanda `source`
supaya laporan pendapatan satu pintu. **Rekomendasi: lewati** — dua sistem penagihan untuk
satu transaksi adalah sumber selisih angka yang tidak akan pernah selesai.

> **Koreksi (dicek di kode) — melewati `Subscription` saja akan mematikan integrasi.**
> `resolveToken` menghitung `isPaid = (status aktif && ada Subscription aktif) || hostingStatus === "active"`,
> dan handler MCP (`route.ts` baris ±2916) menolak **seluruh** panggilan dengan 402
> `PAYMENT_REQUIRED` bila `isPaid` salah — termasuk `create_content_type`. Bawaan
> `hostingStatus` adalah `"trial"`. Jadi tenant nocode dibuat **tanpa `Subscription` dan dengan
> `hostingStatus: "active"`**. Nilai itu hanya diubah alur pembayaran Midtrans dan tidak ada
> cron yang mengkedaluwarsakannya, sehingga stabil.

**Dashboard pemilik akan kebanjiran.** Daftar workspace akan didominasi tenant nocode.
Butuh filter `source` di UI dan di `GET /api/tenants`, dengan bawaan menyembunyikan tenant
nocode.

**`Tenant.ownerId` tidak diisi oleh route yang ada.** Kepemilikan hari ini hanya lewat
`TenantMember`. Untuk tenant nocode, isi `ownerId` dengan akun layanan agar kepemilikan
terbaca langsung dari baris tenant tanpa join.

### 5.7 Gerbang Pembayaran MCP

`resolveToken` mengisi `isPaid`, `plan`, `hostingType`, dan `paymentError`. Tenant baru dari
nocode berstatus gratis, jadi harus diputuskan sebelum dibangun:

- Plan bawaan tenant nocode — `free`, atau plan khusus `nocode`?
- Tool MCP mana yang terbuka sebelum pengguna nocode membayar? Usulan: seluruh CRUD schema
  dan konten terbuka — tanpa itu produk nocode tidak berfungsi sama sekali — sedangkan
  `deploy_to_vercel` dan `configure_vercel_domain` tertutup.
- Kuota media dan jumlah content type untuk tenant nocode gratis.

### 5.8 Satu Project nocode = Satu Tenant

Diputuskan pemilik (16 September 2026). `externalRef` berbentuk `nocode:<project.id>`, dan
provisioning terjadi saat pengguna **membuat project**, bukan saat mendaftar.

Yang didapat: isolasi bersih per website. Content type milik "Koperasi Merah Putih" tidak
bisa bertabrakan dengan milik "Toko Bunga Sari", walaupun keduanya milik pengguna yang sama.

Yang harus diterima, dan diurus:

| Konsekuensi                                                     | Yang harus dikerjakan                                                                                                       |
| ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Jumlah tenant tumbuh secepat jumlah website                       | Batas plan sudah tidak berlaku (§5.3), tetapi ukuran tabel `tenants` dan turunannya tumbuh nyata. Pantau.                    |
| Daftar workspace pemilik akan sangat panjang                      | Filter `source` (§5.6) naik dari "sebaiknya" menjadi **wajib**.                                                              |
| Project dihapus di nocode → tenant harus ikut dihapus              | Kontrak dan pagarnya di §5.9. Pekerjaan baru, sudah masuk §7.                                                          |
| Satu pengguna punya banyak tenant                                 | Kalau kelak ia naik kelas jadi pelanggan developer, yang dialihkan adalah beberapa tenant sekaligus, bukan satu.               |

> Tanpa jalur penghapusan, dalam beberapa bulan sebagian besar isi tabel `tenants` adalah
> sampah dari percobaan yang sudah dibuang. §5.9 menutup lubang itu.

### 5.9 Menghapus Tenant Saat Project nocode Dihapus

Diputuskan pemilik (16 September 2026): project dihapus di nocode → **tenant dihapus** di
SaCMS. Bukan dinonaktifkan.

#### Kabar baik: jalur hapus yang lengkap sudah ada

`DELETE /api/tenants/[tenantId]` sudah melakukan pembongkaran menyeluruh, dan **harus dipakai
ulang** — jangan ditulis ulang:

| Langkah                                                        | Isi                                                                |
| ---------------------------------------------------------------- | -------------------------------------------------------------------- |
| 1. `deleteTenantStorage(tenantSlug)`                             | Hapus objek media (lihat peringatan di bawah)                        |
| 2. `dropEnterpriseDb(databaseUrl)`                               | Jatuhkan database khusus bila ada — tenant nocode tidak punya        |
| 3. Hapus chat v0.dev                                             | **Ikut dihapus** bersama AI builder (§3.4) — ini kode AI di dalam rute hapus |
| 4. Bersihkan yang tanpa cascade                                  | `paymentTransaction`, `invoice`, `customPlanOverride`, `infrastructureCredential` |
| 5. `db.tenant.delete()`                                          | 56 relasi `onDelete: Cascade` ikut jatuh: content type, entry, media, token, webhook, member |
| 6. `logAudit(TENANT_DELETED)`                                    | Lihat catatan di bawah                                               |

#### Satu aturan keamanan yang tidak bisa ditawar

Endpoint hapus M2M **hanya boleh menghapus tenant dengan `source = "nocode"` dan
`externalRef` yang cocok dengan yang dikirim pemanggil.**

```http
DELETE /api/platform/tenants/{externalRef}
Authorization: Bearer <PLATFORM_PROVISION_KEY>
```

Perhatikan: alamatnya memakai **`externalRef`, bukan `tenantId`**. Itu disengaja. Dengan
`tenantId`, kunci yang bocor bisa menghapus workspace pelanggan developer mana pun. Dengan
`externalRef`, yang bisa disentuh hanya tenant yang memang lahir dari nocode.

Tambahan yang wajib:

- Tolak dengan 404 (bukan 403) bila `source ≠ "nocode"` — jangan membocorkan keberadaan tenant
  milik orang lain.
- Idempoten: dipanggil dua kali → 204 dua kali, bukan 404 di panggilan kedua.
- Audit **sebelum** baris tenant hilang, dan `await`-kan.

#### ⚠️ Tiga cacat di jalur hapus yang ada, dan harus diperbaiki sebelum dipakai mesin

Ketiganya bisa ditoleransi saat penghapusan dilakukan manusia sesekali. Begitu dipanggil mesin
ribuan kali, ketiganya menjadi masalah nyata.

**1. Media tenant shared tidak ikut terhapus.** `deleteTenantStorage` hanya menyapu bucket
S3 bila tenant punya `storageConfig` sendiri (`isCustom`). Kalau tidak, ia jatuh ke cabang
`else` yang menghapus **direktori lokal** `public/upload/<slug>`. Tenant nocode adalah tenant
shared, jadi kalau medianya ada di R2 platform, **media itu tidak akan dihapus.**

Dengan satu tenant per project dan penghapusan yang sering, ini justru menjadi kebocoran
terbesar — persis hal yang ingin dihindari. Dua jalan: beri tenant nocode `storageConfig`
sendiri sehingga `isCustom` bernilai benar, atau perluas `deleteTenantStorage` agar juga
menyapu bucket platform di bawah prefix tenant itu. **Harus diputuskan sebelum fitur ini
hidup.**

**2. Urutannya tidak transaksional.** Storage dihapus di langkah 1, baris tenant di langkah 5.
Kalau langkah 5 gagal, media sudah hilang sementara tenantnya masih hidup — dan percobaan
ulang otomatis akan mengulang keadaan itu. Untuk jalur mesin, balik urutannya: hapus baris
tenant lebih dulu, catat `tenantSlug` ke antrean pembersihan storage, lalu sapu storage dari
antrean itu. Media yatim sebentar jauh lebih murah daripada tenant hidup tanpa media.

**3. Audit ditulis setelah baris dihapus dan tidak di-`await`.** `logAudit` dipanggil tanpa
`await` **setelah** `db.tenant.delete()`, dengan `entityId` yang menunjuk baris yang sudah
tidak ada. Kalau proses mati di antaranya, penghapusan tidak tercatat sama sekali. Untuk
penghapusan otomatis, catat lebih dulu dan `await`.

#### Satu penghalang yang justru menguatkan §5.6

Rute hapus menolak tenant yang punya `Subscription` aktif berbayar:

```ts
if (activeSub) return 403 "Cannot delete an active paid workspace..."
```

Kalau kita **tetap** membuat `Subscription` untuk tiap tenant nocode, penghapusan akan
tertolak diam-diam begitu pengguna berlangganan. Ini memperkuat rekomendasi §5.6: **lewati
pembuatan `Subscription` untuk `source = "nocode"`** — dengan `hostingStatus: "active"` agar
gerbang MCP tetap terbuka — dan biarkan penagihan sepenuhnya di nocode.

#### ⚠️ Di nocode, "hapus project" hari ini adalah soft delete

`deleteProject` di nocode memanggil `projectService.softDelete`, yang menulis
`deletedAt: new Date(), status: "ARCHIVED"`. Barisnya tetap ada dan bisa dipulihkan.

Kalau tindakan itu langsung menghapus tenant di SaCMS, hasilnya timpang: **sisi nocode bisa
dibatalkan, sisi SaCMS tidak.** Pengguna memulihkan project-nya dan mendapat project tanpa
schema, tanpa konten, tanpa media.

Dua jalan yang konsisten:

| Jalan                                                                       | Akibat                                                                                        |
| ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| **A. Tenggang waktu — DIPILIH.** Hapus di UI = soft delete seperti sekarang; satu cron menghapus tenant 30 hari setelah `deletedAt` | Kedua sisi tetap bisa dipulihkan selama tenggang; setelah itu keduanya hilang bersama. Sampah tetap disapu. |
| **B. Hapus permanen langsung.** Ubah `softDelete` menjadi hapus sungguhan     | Kedua sisi konsisten seketika. Tapi menghilangkan jaring pengaman yang sudah ada, dan `duplicateProject` serta arsip ikut terdampak. |

**Pemilik memilih A (16 September 2026): tenggang waktu.** Hapus di UI tetap soft delete
seperti sekarang; satu cron menghapus tenant **30 hari** setelah `deletedAt`. Kontrak endpoint di atas
tidak berubah — yang berubah hanya siapa yang memanggilnya dan kapan.

### 5.10 Tingkat Paket nocode — Semuanya Shared, Enterprise Ada di Sini

Prinsip yang ditetapkan pemilik (16 September 2026):

| Paket                        | Ada di        | Hosting website       | Storage & database konten   |
| ---------------------------- | ------------- | --------------------- | --------------------------- |
| **Standar, Pro, Business**   | nocode        | Vercel                | Shared, di data plane ini   |
| **Enterprise**               | **SaCMS saja** | Vercel               | Shared, kuota lebih besar (§5.13) |

**nocode tidak punya paket Enterprise.** Konsekuensi pentingnya: **setiap tenant yang lahir
dari nocode selalu `shared_vercel`** — tidak ada percabangan target hosting di jalur
provisioning, dan `resolveHostingTarget()` tidak perlu disentuh sama sekali.

Kekhawatiran di revisi sebelumnya — bahwa `"enterprise"` tidak ada di `VPS_PLANS` sehingga
tenant Enterprise nocode akan mendarat di Vercel — **gugur**, karena tenant seperti itu tidak
pernah dibuat.

`PAID_PLANS` sudah memuat `"standar"`, `"pro"` (lewat alias), dan `"bisnis"`/`"business"`,
jadi gerbang `isTenantPlanPaid` tidak perlu diubah.

#### Enterprise dari nocode: pengalihan, bukan migrasi

**Enterprise = diarahkan ke SaCMS, bukan dimigrasikan.** Diputuskan pemilik (16 September
2026). Paket Enterprise **boleh ditampilkan** di halaman harga nocode, tetapi tombolnya adalah
tautan ke `https://developer.sacms.cloud` untuk mendaftar dan berlangganan **di sana**. Tidak
ada pembayaran Enterprise di nocode, dan tidak ada pemindahan project nocode ke Enterprise —
pelanggan Enterprise memulai sebagai pelanggan SaCMS.

Konsekuensinya, pekerjaan backup → restore → pengalihan kepemilikan tenant yang sebelumnya
direncanakan untuk jalur naik kelas **dibatalkan**. Di sisi SaCMS tidak ada pekerjaan tambahan untuk jalur ini:
halaman daftar dan langganan Enterprise yang sudah ada di `developer.sacms.cloud` itulah
tujuannya.

#### ⚠️ Lubang penghapusan storage sekarang menimpa 100% tenant nocode

Di revisi sebelumnya lubang ini hanya menimpa tiga paket shared, dan Enterprise dianggap sudah
bersih. Karena nocode tidak punya Enterprise, **seluruh tenant nocode adalah tenant shared** —
jadi lubangnya menimpa semuanya, tanpa kecuali.

Rantainya, diperiksa di kode:

```
getS3Client(tenantSlug)  →  tenant tanpa storageConfig  →  jatuh ke R2 platform (getResolvedStorageConfig)
                                                             ↓
                            media tenant nocode TERSIMPAN di bucket platform
                                                             ↓
deleteTenantStorage()    →  isCustom = false             →  hanya menghapus direktori LOKAL
                                                             public/upload/<slug>
                                                             ↓
                            objek di bucket platform TIDAK PERNAH DISENTUH
```

Dengan satu tenant per project dan penghapusan bertenggang 30 hari, ini bukan kebocoran
teoretis — ia tumbuh setiap kali seorang pengguna membuang percobaannya.

**Diputuskan pemilik (16 September 2026): perluas `deleteTenantStorage`.** Bukan memberi
`storageConfig` per tenant.

| Jalan                                             | Penilaian                                                                                                                                                   |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ~~Beri tiap tenant nocode `storageConfig` sendiri~~ | **Ditolak.** Satu tenant per project berarti ribuan bucket atau ribuan kredensial. R2 membatasi jumlah bucket per akun, dan kredensial sebanyak itu adalah beban operasi tersendiri. |
| **Perluas `deleteTenantStorage` — DIPILIH**          | Pada cabang `!isCustom`, sapu **juga** bucket platform di bawah prefix `upload/<slug>/` — prefix yang sama yang dipakai cabang `isCustom`. Perubahan terbatas di satu fungsi. |

Prefiksnya sudah tenant-scoped, jadi penyapuan tidak bisa menyentuh data tenant lain.
Kehati-hatian yang tertulis di komentar fungsi itu menyangkut operasi **baca/presign** — agar
tenant shared tidak membaca dari tempat yang salah — bukan penghapusan prefix miliknya sendiri
saat pembongkaran.

Efek sampingnya positif: lubang yang sama juga menimpa tenant developer shared hari ini, dan
perbaikan ini menutupnya sekalian.

### 5.11 SaCMS Hanya Menjual Enterprise

Diputuskan pemilik (16 September 2026): paket **Free, Starter/Standar, Pro, dan Business
dihapus dari SaCMS**. SaCMS khusus developer, agensi, dan instansi yang sifatnya Enterprise.
Paket kecil hidup di nocode.

#### Di mana paket SaCMS tinggal — bukan satu tempat

| Tempat                                                                                   | Isi                                                                                   |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| Content entry `sacms-workspace-pricing` dan `sacms-account-pricing` di workspace global     | Katalog yang tampil — **data di database production**, bukan kode                   |
| `src/lib/constants/tenant-limits.ts` (`DEFAULT_LIMITS`, `USER_PLAN_LIMITS`)                 | Nilai cadangan: `free`, `starter`, `pro`, `enterprise`, `enterprise-vps`, `vps-s/m/l`, `enterprise-vds`, `vds-s/m/l`, `custom`, plus alias `standar`, `profesional`, `business`, `bisnis` |
| `src/app/api/public/plans/route.ts`                                                         | Menyuntikkan paket "Free Forever" secara hardcoded                                   |
| `src/components/landing/sections/pricing-grid.tsx`                                          | Kartu harga di landing                                                                |
| `POST /api/tenants`                                                                         | Workspace baru bawaan `plan = "free"`                                                 |
| `src/lib/infrastructure/hosting-plan.ts`                                                    | `PAID_PLANS`, `VPS_PLANS`                                                             |

#### Cakupan penghapusan

1. **Katalog publik:** unpublish content entry selain Enterprise. Ini perubahan data production.
2. **`/api/public/plans`:** berhenti menyuntikkan "Free Forever".
3. **`pricing-grid.tsx`:** hanya kartu Enterprise.
4. **Pendaftaran workspace:** `POST /api/tenants` tidak lagi membuat workspace `free`; membuat
   workspace menuntut langganan Enterprise.
5. **`tenant-limits.ts`: jangan hapus kunci selama masih ada tenant yang memakainya.**
   `DEFAULT_LIMITS.free` adalah cadangan untuk plan yang tidak dikenal
   (`DEFAULT_LIMITS[tenant.plan] || DEFAULT_LIMITS.free`). Menghapusnya membuat
   `getTenantPlanConfig` mengembalikan `undefined` untuk tenant lama dan tenant nocode.

#### Tenant nocode butuh plan internal

Tenant asal nocode tetap tinggal di SaCMS dan tetap membutuhkan `Tenant.plan`. Rekomendasi:
plan internal **`nocode`** — tidak tampil di katalog, punya entri batas sendiri di
`tenant-limits.ts` (penagihan dan batas sebenarnya ada di nocode), punya batas rate limit MCP
sendiri (`getTenantRateLimit(plan)`).

#### Dua ketidakcocokan yang terungkap saat memeriksa ini

**Gerbang pembayaran MCP tidak memakai `PAID_PLANS`.** `resolveToken` menghitung
`isPaid = (tenant.status === "active" && ada Subscription aktif) || tenant.hostingStatus === "active"`,
dan handler MCP menolak **seluruh** panggilan dengan 402 bila salah. Karena tenant nocode dibuat
tanpa `Subscription` (§5.6), ia **wajib** dibuat dengan `hostingStatus: "active"`.

**Konsep "plan VPS" dihapus.** MCP (`plan.startsWith("vps-") || plan === "enterprise"`) dan
`hosting-plan.ts` (`VPS_PLANS`) hari ini memakai dua definisi berbeda. Karena Enterprise kini memakai
infrastruktur bersama (§5.13), keduanya — beserta `hostingType: "dedicated_vps"` — dihapus, bukan
disatukan.

#### ⛔ Yang memblokir

**Apakah ada tenant atau langganan aktif di production berplan Free, Starter, atau Pro?**
Kalau ada, harus diputuskan: dipertahankan sampai masa langganannya habis, dimigrasikan ke
Enterprise, atau dihentikan dengan pemberitahuan. Karena itu penghapusan paket **belum
dikerjakan di kode** — jawabannya ada di database production, bukan di repositori.

### 5.12 Satu Pintu Admin — Ringkasan nocode di `/admin/nocode`

Diputuskan pemilik (16 September 2026), dicatat di nocode ADR-016. Pemilik memakai
`admin.sacms.cloud` sebagai beranda; panel admin nocode **tidak** dipindahkan ke sini.

| Bagian                                            | Isi                                                                                     |
| ------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `src/lib/nocode-summary.ts`                        | Klien server: memanggil `GET {NOCODE_BASE_URL}/api/platform/ringkasan`, timeout 8 detik, validasi Zod. Kunci tidak pernah sampai ke browser. |
| `GET /api/admin/nocode/summary`                    | `withAdminAuth`, audiens sama dengan laporan billing (`super_admin`, `admin`). Selalu 200 dengan flag `ok`. |
| `/admin/nocode`                                    | Kartu pengguna, project, build, kredit, status sistem, perlu perhatian, keuangan 30 hari per paket, tautan ke admin nocode |
| `NocodeFinanceSection`                             | Konsolidasi di halaman laba-rugi dan margin keuntungan                                  |
| Sidebar                                            | "SaCMS nocode" di grup OPERATIONS                                                       |
| `__tests__/lib/nocode-summary.test.ts`             | Kunci kosong tidak memanggil nocode; 401; jaringan putus/5xx; bentuk tak dikenal        |

Env baru: `NOCODE_BASE_URL` (kosong = `https://sacms.cloud` di production,
`http://localhost:3001` di lokal) dan `NOCODE_SUMMARY_KEY` (= `PLATFORM_SUMMARY_KEY` di nocode).

**Tidak ada aksi terhadap data nocode dari sini.** Semua tombol berupa tautan ke admin nocode,
karena aksinya bergantung pada Better Auth, v0, Vercel, dan ledger kredit milik nocode.

**Konsolidasi keuangan menjajarkan dua jenis angka yang berbeda:** MRR SaCMS dari langganan aktif
dan estimasi 30 hari nocode (harga paket × pengguna saat ini). Keduanya dijumlahkan dengan label
"indikatif", tidak dilebur ke `calculateLiveFinancialReports()`, sehingga laporan SaCMS yang ada
tidak berubah.

### 5.13 Enterprise di Infrastruktur Bersama — Tanpa VPS per Tenant

Diputuskan pemilik (17 September 2026): **tidak ada VPS terpisah untuk tenant Enterprise.** Seluruh
pelanggan — Standar, Pro, dan Business dari nocode, serta Enterprise di SaCMS — memakai database
bersama di VPS SaCMS, object storage bersama, dan hosting website di Vercel. Pemakaian storage setiap
pelanggan dihitung; yang melewati kuota bisa membeli storage tambahan.

| Paket                  | Ada di | Hosting website | Database konten | Storage media                                      |
| ---------------------- | ------ | --------------- | --------------- | -------------------------------------------------- |
| Standar, Pro, Business | nocode | Vercel          | Shared          | Object storage bersama, kuota paket                |
| Enterprise             | SaCMS  | Vercel          | Shared          | Object storage bersama, kuota lebih besar + add-on |

#### Kenapa VPS per tenant dihentikan

Diperiksa 17 September 2026:

- Belum ada satu pun VPS Enterprise di production (tabel `infrastructure_servers` kosong); alur
  provisioning belum pernah berjalan dengan penyedia sungguhan.
- Alur itu tidak akan pernah menghasilkan server aktif: respons pembuatan instance tidak memuat IP,
  sehingga DNS tidak dibuat dan connection string menunjuk ke domain yang tidak ada.
- Kunci deploy SSH yang dibuat SaCMS (ed25519 PKCS8) tidak bisa dibaca pustaka SSH yang dipakai
  (`ssh2`), jadi deploy ke VPS tidak akan bisa login.
- Image MinIO tidak lagi bisa ditarik dari Docker Hub tanpa login.
- Paket VPS Storage tidak bisa dipesan lewat API penyedia, padahal dijual di katalog.

Memperbaiki semuanya berarti menjalankan produk infrastruktur tersendiri untuk nol pelanggan.

#### Yang harus diterima

| Konsekuensi                                                    | Artinya                                                                                                                                                                  |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Tidak ada database atau server khusus per pelanggan            | Isolasi antar-tenant hanya di level baris (`tenantId`). Pelanggan yang mensyaratkan database terpisah atau lokasi data tertentu (misalnya instansi pemerintah) tidak bisa dilayani tanpa keputusan baru. |
| Website Enterprise membaca konten lewat API SaCMS              | Aplikasi yang butuh database sendiri membawa database-nya sendiri; SaCMS tidak menyediakannya.                                                                          |
| Satu VPS dan satu database melayani semua pelanggan            | Backup ke luar VPS dan uji pemulihan (§6) menjadi wajib, bukan pilihan.                                                                                                   |
| Semua website pelanggan ada di tim Vercel milik SaCMS          | Bandwidth, build, dan function tertagih ke SaCMS; perlu dipantau per project dan dibatasi per paket. Ketentuan Vercel untuk menghosting situs klien dalam satu tim perlu dikonfirmasi. |

#### Kuota storage — yang sudah ada dan yang harus diperbaiki

Sudah ada di kode: pemakaian = jumlah `media.size` per tenant (`getWorkspaceUsage`); batas =
`max_storage` paket (+ override admin) + `Tenant.storageExtraBytes`; dicek saat upload di
`POST /api/tenant/[tenant]/media`; add-on `topup_storage_10gb` (Rp35.000, +10 GB).

Celah yang ditemukan — **1–5 diperbaiki 17 September 2026** (`getStorageQuota` dan `checkStorageUpload` di
`plan-enforcement.ts`, model `StorageAddon`, `Media.variantBytes`, uji `__tests__/lib/storage-quota.test.ts`);
6 dikerjakan bersama MinIO:

| # | Celah                                                                                                         | Akibat                                                                                   | Perbaikan                                                         |
| - | ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| 1 | Pemeriksaan upload menjumlahkan pemakaian dalam **byte** dengan ukuran file baru dalam **MB** (`current + newFilesSizeMB > max`) | Ukuran file yang sedang diunggah praktis diabaikan; tenant yang hampir penuh tetap bisa mengunggah file besar | Bandingkan dalam byte                                             |
| 2 | `enterpriseBypass` memberi **tanpa batas** untuk paket bernama `vps`/`dedicated`/`enterprise`, atau tenant yang punya `databaseUrl` + `storageConfig` | Enterprise tidak pernah terhitung                                                        | Hapus bypass; Enterprise mendapat kuota besar di `tenant-limits`  |
| 3 | Pengguna `super_admin` melewati semua batas                                                                    | Bila media nocode diunggah atas nama akun layanan `super_admin` (§5.3), seluruh tenant nocode tanpa kuota | Batas storage mengikuti tenant, bukan peran pengunggah; periksa jalur upload nocode |
| 4 | `storageExtraBytes` hanya pernah ditambah                                                                      | Sekali bayar Rp35.000 = +10 GB selamanya, padahal biaya object storage bulanan            | Add-on berulang mengikuti periode langganan, atau berbatas waktu  |
| 5 | Hanya `size` berkas asli yang dihitung                                                                         | Thumbnail dan versi medium ikut tersimpan tetapi tidak terhitung                          | Hitung ukuran varian, atau tetapkan faktor                        |
| 6 | Tanpa `R2_*`, media disimpan ke disk lokal VPS (`uploadToLocal`)                                              | Bukan object storage                                                                     | MinIO di VPS SaCMS wajib di production (lihat di bawah)           |

Setelah perubahan ini, `Tenant.databaseUrl` dan `Tenant.storageConfig` (routing database dan storage per
tenant) tidak lagi dipakai.

#### Keputusan lanjutan (17 September 2026)

| Hal                  | Keputusan                                                                                                   |
| -------------------- | ----------------------------------------------------------------------------------------------------------- |
| Object storage       | **MinIO di VPS SaCMS.** Media setiap workspace disimpan di folder bernama id workspace (tenant).              |
| Add-on storage       | **Berulang bulanan**, bukan sekali bayar selamanya.                                                          |
| Pengguna nocode      | **Bisa membeli storage tambahan.** Penagihan di nocode; pembelian menaikkan kuota tenant-nya di SaCMS.        |
| Katalog production   | 22 entry paket `vps-*`/`vds-*`/`vps-storage-*` **di-unpublish** (status `DRAFT`). Cadangan: `/root/sacms-vps-plans-backup-20260917.csv` di VPS SaCMS. Tidak ada tenant atau langganan pada paket itu. |

**Risiko MinIO yang harus diterima:** image resmi `minio/minio` dan `minio/mc` tidak lagi bisa ditarik dari
Docker Hub tanpa login, dan rilis reguler terakhir di Quay bertanggal 7 September 2025. Pakai image yang
dikunci ke tag rilis (`quay.io/minio/minio:RELEASE.2025-09-07T16-13-09Z`, `quay.io/minio/mc:RELEASE.2025-08-13T08-35-41Z`),
salin ke registry milik SaCMS (GHCR), dan pantau pembaruan keamanan. Data MinIO berbagi disk dengan database,
jadi backup keduanya ke luar VPS (§6) wajib.

#### Kode yang dihapus — selesai 17 September 2026

- `src/lib/infrastructure/`: provisioner, klien API penyedia VPS, cloud-init, deployer VPS, deploy artifact,
  SSH, DNS, enkripsi kredensial, dan migration runner; `docker/mcp-contabo/`.
- Model Prisma `InfrastructureServer`, `InfrastructureCredential`, `VpsDeployment` (tabel production kosong).
- Tool MCP VPS dan izin token `deploy`; `hostingType: "dedicated_vps"`.
- `/admin/infrastructure` beserta API-nya, cron `infrastructure/health`, provisioning otomatis setelah
  pembayaran, kartu status penyedia VPS di dashboard admin, kredensial penyedia di Pengaturan Platform.
- Kategori VPS/VDS/Storage di laporan keuangan; deploy ke VPS di panel Hosting; konsol server VPS di halaman
  Database & Storage.
- Env penyedia VPS, `SACMS_SERVER_IPS`, `INFRA_*`, dan Cloudflare DNS untuk VPS.

**Dipertahankan: Bring Your Own Database/Storage** (`Tenant.databaseUrl`, `Tenant.storageConfig`). Diputuskan
pemilik (17 September 2026): dijual sebagai **layanan terkelola yang di-setup manual oleh tim IT SaCMS** — pelanggan
menghubungi SaCMS, tim menyiapkan VPS (misalnya Contabo), PostgreSQL, dan/atau storage, lalu menyambungkannya ke
workspace. Tidak ada provisioning otomatis. Workspace dengan storage sendiri tidak dikenai kuota storage SaCMS.
Database pelanggan yang disambungkan harus diberi skema SaCMS terbaru oleh tim (`prisma db push`), termasuk kolom
`Media.variantBytes`.

#### Kuota storage — keputusan dan perilaku setelah perbaikan

- **Dihitung per workspace** (diputuskan 17 September 2026).
- Pemakaian = ukuran berkas asli + thumbnail + versi medium. Media lama tercatat tanpa varian (`variantBytes = 0`).
- Batas = kuota paket (atau override admin) + add-on aktif. Paket bernama Enterprise/VPS dan pengunggah
  `super_admin` **tidak** lagi bebas kuota; yang dikecualikan hanya workspace dengan storage sendiri dan instalasi
  dengan lisensi enterprise tingkat instance.
- Upload ditolak bila pemakaian + ukuran berkas yang diunggah melewati batas.
- Add-on 10 GB berlaku **satu bulan** sejak dibayar, dicatat per order sehingga tidak pernah diberikan dua kali.
  Tombol **Perpanjang** memulai bulan berikutnya tepat saat add-on lama berakhir. Pengingat email 7 hari dan 1 hari
  sebelum berakhir dikirim cron harian `/api/cron/billing-reminders` (service `cron` di docker compose).

#### Harga dan kuota — diputuskan 17 September 2026

| Item                                  | Keputusan                                                                 |
| ------------------------------------- | ------------------------------------------------------------------------- |
| Kuota bawaan Free / Pro / Business    | 100 MB / 5 GB / 10 GB (tetap)                                             |
| Kuota bawaan Enterprise               | 50 GB                                                                     |
| Add-on storage                        | Rp50.000 per 10 GB per bulan (`topup_storage_10gb`)                       |
| Database & storage sendiri (terkelola) | Setup Rp2.500.000 + Rp1.000.000/bulan; bayar pertama Rp3.500.000          |

Alur layanan database & storage sendiri (`src/lib/billing/managed-infra.ts`): pelanggan memesan dan membayar di
Langganan → Add-on → status `awaiting_setup` dan tiket support prioritas tinggi untuk tim IT → tim IT menyiapkan server
lalu menyimpan sambungan di Database & Storage workspace sebagai super admin → status `active`. Perpanjangan
`managed_byodb_monthly` menambah satu bulan; bila lewat masa bayar, cron menandai `expired` dan membuka tiket untuk
memutus sambungan. Hanya super admin (atau instalasi self-hosted berlisensi enterprise) yang boleh mengubah sambungan.

Object storage: MinIO di VPS SaCMS (profil compose `storage`), bucket `sacms-media`, kunci `<tenantId>/<ext>/<file>`,
publik lewat `media.sacms.cloud`. Media lokal lama dipindah dengan `scripts/migrate-local-media.ts` (dry run bawaan,
`--apply` untuk menjalankan).
  `Tenant.storageExtraBytes` tidak dibaca lagi (di production semuanya 0).

## 6. TASK — Kesiapan VPS untuk SaCMS nocode

SaCMS nocode berjalan di **VPS yang sama** (nocode ADR-017), dalam proyek compose terpisah
`/opt/sacms-nocode` yang bergabung ke jaringan `sacms_default` milik compose ini. Koneksi
database dan panggilan MCP tidak melintasi internet, jadi PgBouncer dan TLS database tidak
diperlukan.

| Item                 | Isi                                                                                    |
| -------------------- | -------------------------------------------------------------------------------------- |
| Database             | `sacms_nocode`, terpisah dari database CMS di server PostgreSQL 17 yang sama            |
| Peran DB             | `nocode_app`, hak hanya ke `sacms_nocode`                                               |
| Koneksi              | `postgres:5432` lewat jaringan Docker; jumlah pool kedua aplikasi < `max_connections`  |
| Alias jaringan       | Service SaCMS bernama `app`; service nocode **wajib** bernama lain (`nocode`)          |
| Caddy                | `sacms.cloud` → `127.0.0.1:3001`, dirilis saat cutover bersama akar = login            |
| Sumber daya          | `mem_limit` untuk `app` dan `nocode`                                                    |
| Pemantauan           | Alarm untuk disk penuh, memori, dan kegagalan cadangan                                  |

### ⚠️ Dua celah yang sudah ada hari ini

**Backup hanya mencakup database `sacms`.** Layanan `db-backup` menjalankan `pg_dump` dengan
`PGDATABASE: sacms` dan menyimpan hasilnya di `./db/backups` — disk VPS yang sama. Database
`sacms_nocode` tidak akan ikut tercadangkan, dan VPS yang hilang membawa serta backupnya. Ubah
menjadi dump per database (atau `pg_dumpall`), kirim salinan ke luar VPS, dan uji pemulihan.

**Cron SaCMS hanya terdaftar di `vercel.json`.** `publish` (tiap 5 menit), `webhook-retry` (tiap
2 menit), `/api/admin/billing/generate-invoices` (harian), dan `cleanup-logs` (harian) tidak
dijadwalkan oleh compose maupun CI; satu-satunya petunjuk adalah `scripts/cron-jobs.md` yang
meminta crontab manual. Rute `backup`, `suspend-tenants`, dan `infrastructure/health` bahkan tidak
terdaftar di mana pun. Periksa `crontab -l` di VPS. Rekomendasi: container penjadwal di compose ini
yang memanggil `http://app:3000/api/cron/*` dengan `CRON_SECRET` — pola yang sama dipakai nocode.

> Cadangan yang belum pernah diuji pulih bukan cadangan. Ini menggantikan PITR Neon yang
> hilang dari sisi nocode — kalau langkah ini dilewati, rencana ini **menurunkan** keandalan,
> bukan memindahkannya.

---

## 7. RULES — Urutan Pengerjaan

Kerjakan berurutan. Langkah 2 tidak boleh dimulai sebelum 1 hijau di CI.

| #   | Pekerjaan                                                                      | Perkiraan |
| --- | ------------------------------------------------------------------------------ | --------- |
| 1   | **Pindahkan** 5 rute non-AI (§3.3) + perbarui pemanggilnya; `bun run build` hijau | 0,5 hari  |
| 2   | Hapus berkas §3.1 + suntingan §3.4 + lepas dependency §3.5                      | 0,5 hari  |
| 3   | Migrasi Prisma A (lepas relasi) → cadangkan tabel `sites*` → Migrasi B (DROP)   | 0,5 hari  |
| 4   | Akun layanan `super_admin` **tanpa jalur login** + uji CI penjaganya (§5.3)      | 0,5 hari  |
| 5   | `POST /api/platform/tenants` + kolom `source`/`externalRef` + audit + rate limit | 1 hari    |
| 5b  | Filter `source` di `GET /api/tenants` + dashboard pemilik (§5.6)                 | 0,5 hari  |
| 5c  | `DELETE /api/platform/tenants/{externalRef}` + 3 perbaikan jalur hapus (§5.9)    | 1 hari    |
| 5d  | Perluas `deleteTenantStorage` agar menyapu bucket platform (§5.10)              | 0,5 hari  |
| 6   | Database & peran `sacms_nocode`; `db-backup` mencakupnya + salinan ke luar VPS (§6) | 0,5 hari  |
| 6b  | Penjadwal cron di container untuk SaCMS — ganti `vercel.json` (§6)             | 0,25 hari |
| 6c  | Blok Caddy `sacms.cloud` → nocode, dirilis saat cutover (§6)                    | 0,25 hari |
| 7   | Cadangan + uji pemulihan sungguhan                                             | 0,5 hari  |
| 8   | Revisi docs 03, 04, 12; arsipkan `v0.md` & `aicms.md`; perbarui `00-README.md` | 0,5 hari  |
| 9   | Hapus Enterprise VPS dari kode (§5.13) — **selesai**                            | (selesai) |
| 10  | Perbaiki kuota storage: satuan byte, bypass Enterprise & `super_admin`, varian (§5.13) — **selesai** | (selesai) |
| 11  | Add-on storage sebulan, perpanjangan & pengingat, layanan BYODB terkelola, MinIO — **selesai di kode**, belum deploy (§5.13) | (selesai) |
| 12  | MinIO di VPS SaCMS, folder per workspace; pindahkan media dari disk lokal (§5.13) | 1–1,5 hari |
| 13  | Unpublish paket VPS/VDS/Storage di katalog production (§5.13) — **selesai**   | (selesai) |
| 14  | Pembelian storage dari nocode menaikkan kuota tenant di SaCMS (§5.13)          | 1 hari    |
|     | **Total sisa**                                                                 | **± 11 hari** |

## 8. OUTPUT FORMAT — Definition of Done

- [ ] `bun run test` dan `bun run build` hijau tanpa `@ts-ignore` baru.
- [ ] `grep -rn "v0-client\|claude-builder-client\|lib/ai/\|sandpack\|db\.site" src/` tidak
      mengembalikan apa pun.
- [ ] Panel Hosting (`hosting-deployments-view.tsx`) masih bisa deploy ke Vercel — diuji
      sungguhan, bukan hanya lolos kompilasi.
- [ ] Import/export schema dan export starter kit masih jalan di rute barunya.
- [ ] Smart-fill, translate, dan content-assist masih jalan (tidak ikut terhapus).
- [ ] Tabel `sites*` sudah di-`pg_dump` dan salinannya ada di luar VPS sebelum di-`DROP`.
- [ ] `POST /api/platform/tenants` diuji: dipanggil dua kali dengan `Idempotency-Key` sama
      menghasilkan **satu** tenant.
- [ ] ApiToken hasil provisioning berhasil memanggil `create_content_type` lewat MCP.
- [ ] Akun layanan berperan `super_admin` dengan `password IS NULL` dan **tanpa baris
      `Account`**; percobaan login dengan kata sandi apa pun mengembalikan `null`. Diuji di CI.
- [ ] ApiToken hasil provisioning **tidak** mewarisi kekuasaan super admin — `hasScope()`
      tetap dibatasi izin token (MCP menetapkan `isSuperAdmin: false`).
- [ ] Membuat tenant jauh melampaui `max_workspaces` tetap berhasil, dan `getUserUsage`
      terbukti tidak pernah dipanggil untuk akun layanan.
- [ ] Daftar workspace di dashboard pemilik tidak dibanjiri tenant nocode (filter `source`).
- [ ] `AuditLog` membedakan aksi mesin (`source: "nocode"`) dari aksi pemilik sistem.
- [ ] `DELETE /api/platform/tenants/{externalRef}` **menolak dengan 404** tenant yang
      `source ≠ "nocode"` — diuji dengan tenant pelanggan developer sungguhan.
- [ ] Hapus tenant nocode → content type, entry, media, token, webhook ikut hilang, **dan
      objek storage-nya benar-benar terhapus dari bucket** (bukan hanya baris databasenya).
- [ ] Penghapusan idempoten: panggilan kedua mengembalikan 204, bukan 404.
- [ ] `AuditLog` penghapusan tercatat **sebelum** baris tenant hilang, dan di-`await`.
- [ ] Hapus tenant nocode → objek di **bucket platform** di bawah `upload/<slug>/` benar-benar
      hilang — diperiksa langsung ke bucket, bukan hanya ke database.
- [ ] Tidak ada lagi `dedicated_vps` di kode; seluruh tenant memakai database bersama dan
      website di Vercel (§5.13).
- [ ] `provisionTenant()` menyemai starter kit untuk tenant nocode tanpa menyentuh AI.
- [ ] Pemulihan `pg_dump` `sacms_nocode` sudah **diuji sungguhan** minimal satu kali.
- [ ] Cron SaCMS (`publish`, `webhook-retry`, `generate-invoices`, `cleanup-logs`) terbukti
      berjalan di VPS — dilihat di log, bukan hanya terdaftar di `vercel.json`.
- [ ] `grep -rni "contabo\|dedicated_vps\|provisionTenantInfrastructure" src/` tidak mengembalikan apa pun.
- [ ] Unggahan yang membuat pemakaian melewati kuota ditolak — diuji dengan file yang lebih besar
      dari sisa kuota.
- [ ] Tenant Enterprise dan tenant asal nocode ikut terhitung kuota; tidak ada jalur tanpa batas.
- [ ] Add-on storage berakhir sesuai periodenya, dan kuota kembali ke batas paket.
- [ ] Media production tersimpan di object storage, bukan di disk VPS.
- [ ] Dokumen 03, 04, 12, dan `00-README.md` diperbarui di PR yang sama.

## 9. Keputusan yang Dibutuhkan dari Pemilik

Sudah diputuskan pemilik (16 September 2026):

1. Tenant nocode dibuat oleh **satu akun layanan** berperan **`super_admin`**; pengguna
   nocode tidak punya akun di SaCMS. (§5.1, §5.3)
2. **Satu project nocode = satu tenant.** (§5.8)
3. Tenant dihapus **30 hari** setelah project di-soft-delete di nocode. (§5.9)
4. **nocode tidak punya paket Enterprise** — Enterprise hanya ada di SaCMS; seluruh tenant
   nocode bertarget `shared_vercel`. (§5.10)
5. Pembersihan storage: **perluas `deleteTenantStorage`**, bukan storageConfig per tenant. (§5.10)
6. Pengguna **diberi tahu tanggal** websitenya hilang permanen sebelum tenggang 30 hari habis.
7. Enterprise dari nocode = **tautan ke `developer.sacms.cloud`**, tanpa migrasi. (§5.10)
8. **SaCMS hanya menjual Enterprise.** (§5.11)
9. **Domain:** SaCMS di `developer.sacms.cloud`, kelola konten di `cms.sacms.cloud`; apex
   `sacms.cloud` milik nocode. Kode routing sudah dikerjakan dan diuji.
10. **Satu pintu admin:** ringkasan nocode hanya-baca di `/admin/nocode`; aksi tetap di admin
    nocode. Sudah dikerjakan dan diuji. (§5.12)
11. **Tanpa VPS per tenant (17 September 2026).** Enterprise memakai database bersama, object storage
    bersama, dan hosting Vercel seperti paket lain. Pemakaian storage dihitung dan pelanggan bisa
    membeli storage tambahan. Seluruh rencana VPS Enterprise dibatalkan; kodenya sudah dihapus. (§5.13)
12. **Object storage = MinIO di VPS SaCMS**, folder per workspace; add-on storage **berulang bulanan**;
    pengguna nocode bisa membeli storage tambahan; paket VPS/VDS/Storage **di-unpublish** dari katalog. (§5.13)
13. **Kuota storage per workspace**; **BYODB/BYOS dijual sebagai layanan yang di-setup manual oleh tim IT SaCMS**. (§5.13)

Yang masih terbuka:

1. **Tenant/langganan production berplan Free, Starter, atau Pro** — dipertahankan,
   dimigrasikan ke Enterprise, atau dihentikan? **Memblokir** §5.11.
2. Tenant nocode: plan internal **`nocode`**, **tanpa `Subscription`**, `hostingStatus: "active"`
   (§5.6, §5.11). Rekomendasi — perlu dikonfirmasi.
3. ~~Kuota per workspace atau per akun~~ — diputuskan: per workspace.
4. `docs/12-AI_Integration.md`, `docs/v0.md`, `aicms.md`: diarsipkan atau ditulis ulang?
5. Skill `/sacms-frontend-builder` di `CLAUDE.md` — dipensiunkan bersama AI builder, atau
   diarahkan ulang ke jalur MCP + `developer/export-starter`?
6. Nama rute baru di §3.3 — setuju, atau ada konvensi lain yang Anda inginkan?
7. ~~Harga add-on storage~~ — diputuskan: Rp50.000 per 10 GB per bulan.
8. ~~Harga layanan BYODB/BYOS terkelola~~ — diputuskan: setup Rp2.500.000 + Rp1.000.000/bulan, dipesan dan dibayar di dashboard.
9. ~~Kuota bawaan tiap paket~~ — diputuskan: 100 MB / 5 GB / 10 GB / Enterprise 50 GB.
10. ~~Pelanggan yang mensyaratkan database terpisah~~ — dilayani lewat layanan BYODB/BYOS yang di-setup tim IT
    SaCMS (keputusan 13). Lokasi server untuk instansi yang mensyaratkan data di Indonesia tetap perlu dipilih per kasus.
