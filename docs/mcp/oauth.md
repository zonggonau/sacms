# OAuth untuk MCP Workspace

Written for: pemelihara server MCP dan pengguna yang menyambungkan ChatGPT, Grok, atau Claude.ai ke workspace SaCMS.

Dengan OAuth, klien tidak perlu token di URL. Pengguna memasukkan Server URL dari dashboard workspace, lalu menyetujui akses di halaman SaCMS. Token dibuat dan diperbarui otomatis oleh klien.

**Server URL per workspace** (yang ditampilkan di `/developer/mcp`): `https://<origin>/api/mcp/w/<slug>`. URL ini mengunci koneksi ke satu workspace. Halaman persetujuan hanya menawarkan workspace itu, dan token dari workspace lain ditolak dengan `403`. Ini mencegah salah pilih workspace, misalnya ketika satu akun menjadi owner atau admin di beberapa workspace.

`https://<origin>/api/mcp` (tanpa slug) masih berfungsi untuk koneksi lama. Di sini halaman persetujuan menampilkan daftar workspace yang boleh dipilih.

## Alur

1. Klien memanggil `https://<origin>/api/mcp` tanpa token. Server menjawab `401` dengan `WWW-Authenticate: Bearer resource_metadata="…/.well-known/oauth-protected-resource/api/mcp"` (RFC 9728).
2. Klien mengambil metadata resource, lalu metadata server otorisasi (RFC 8414) dari `/.well-known/*`. Rewrite di `next.config.ts` meneruskannya ke `/api/oauth/well-known/*`.
3. Jika klien belum terdaftar, klien mendaftar di `POST /api/oauth/register` (RFC 7591). Klien publik, tanpa secret.
4. Klien membuka `/oauth/authorize` dengan `code_challenge` (S256, RFC 7636) dan `resource`. Pengguna yang belum masuk diarahkan ke login lalu kembali.
5. Halaman consent menampilkan workspace yang dikelola pengguna (owner atau admin). Saat disetujui, `POST /api/oauth/grant` membuat kode otorisasi dan mengembalikan URL redirect.
6. Klien menukar kode di `POST /api/oauth/token` dengan `code_verifier`. Hasilnya access token (1 jam) dan refresh token (30 hari).
7. Access token adalah baris `api_tokens` dengan `type = "mcp"`. Route MCP memverifikasinya dengan jalur yang sama seperti token manual.

## Aturan keamanan

- **Redirect URI harus terdaftar dan cocok persis.** Endpoint grant menolak URI yang tidak terdaftar, sehingga tidak bisa dipakai sebagai open redirect. Halaman consent juga tidak mengarahkan ke URI yang tidak terdaftar; kesalahan ditampilkan di halaman.
- **Redirect URI hanya boleh `https`**, atau `http` untuk loopback (`localhost`, `127.0.0.1`, `[::1]`). Tanpa fragment dan tanpa userinfo.
- **PKCE S256 wajib.** `plain` ditolak.
- **Kode sekali pakai, 10 menit.** Kode disimpan dalam bentuk SHA-256. Kode langsung dihapus saat ditukar, sehingga replay tidak menemukan apa-apa.
- **Persetujuan hanya untuk owner atau admin.** Diperiksa saat consent dan lagi saat kode ditukar, karena keanggotaan bisa berubah di antaranya.
- **Refresh token dirotasi.** Setiap pemakaian mengganti refresh token lewat compare-and-swap. Refresh token lama yang dipakai lagi dianggap bocor: seluruh koneksi dicabut.
- **Hanya hash yang disimpan.** Access token dan refresh token tidak pernah disimpan dalam bentuk asli.
- **Pencabutan.** Menghapus atau memutar token di `/developer/mcp` juga menghapus koneksi OAuth yang memilikinya, sehingga refresh token tidak bisa dipakai lagi.

## Data

| Tabel (model) | Isi |
|---|---|
| `oauth_clients` (`OAuthClient`) | Klien terdaftar: `clientId`, nama, redirect URI |
| `oauth_codes` (`OAuthCode`) | Kode otorisasi: hash, klien, workspace, user, PKCE challenge, kedaluwarsa |
| `oauth_tokens` (`OAuthToken`) | Koneksi: hash refresh token, klien, workspace, user, `accessTokenId` yang berlaku |

Migrasi: `prisma/migrations/20261126000100_add_mcp_oauth`. Tabel-tabel ini kosong di produksi sebelum migrasi, jadi tidak ada data yang hilang.

## Endpoint

| Path | Fungsi |
|---|---|
| `/.well-known/oauth-protected-resource[/api/mcp]` | Metadata resource (RFC 9728) |
| `/.well-known/oauth-authorization-server` | Metadata server otorisasi (RFC 8414) |
| `/api/oauth/register` | Registrasi klien (RFC 7591) |
| `/oauth/authorize` | Halaman consent |
| `/api/oauth/grant` | Menyimpan keputusan consent, butuh sesi |
| `/api/oauth/token` | Pertukaran kode dan refresh (RFC 6749) |

Kode: [src/lib/mcp/oauth/protocol.ts](../../src/lib/mcp/oauth/protocol.ts) (fungsi murni dan metadata) dan [src/lib/mcp/oauth/service.ts](../../src/lib/mcp/oauth/service.ts) (database).

## Yang belum dilakukan

- **Verifikasi langsung dengan ChatGPT, Grok, dan Claude.ai belum dilakukan.** Tes memeriksa setiap langkah protokol, tetapi belum ada koneksi nyata dari klien-klien itu. Sebelum dianggap selesai, sambungkan satu per satu dan catat hasilnya di CHANGELOG.
- **Platform yang masih memakai URL + Token tetap jalan.** Itu jalur kompatibilitas. Menghapusnya perlu keputusan terpisah.
- **Super admin platform tidak muncul di daftar workspace consent**, hanya owner dan admin keanggotaan. Mereka tetap bisa menyetujui workspace yang mereka kelola sebagai anggota.
- **Global MCP tidak memakai OAuth.** Server itu hanya untuk tim SaCMS dan tetap memakai token global.
