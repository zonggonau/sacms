# MCP SaCMS: panduan untuk agent dan pemelihara

Written for: engineer yang memelihara server MCP, dan engineer yang menghubungkan AI agent atau IDE ke SaCMS.

SaCMS punya dua server MCP. Pilih yang sesuai dengan pekerjaannya.

| | **Workspace** (`/api/mcp`) | **Global** (`/api/mcp/global-schema`) |
|---|---|---|
| Dipakai untuk | Membangun dan merilis website/schema sebuah workspace | Membuat katalog Schema Template dan Website Template platform |
| Siapa yang memakai | Owner/admin workspace, lewat agent atau IDE | Tim SaCMS |
| Pintu masuk | `get_agent_playbook` | `get_builder_guide` |
| Token | Token workspace (`full_access` atau daftar izin) | Token global (`mcp-global-schema`, scope `read`/`demo`/`write`/`publish`) |
| Daftar tool | [tool-manifest.json](tool-manifest.json) (`workspace`) | [tool-manifest.json](tool-manifest.json) (`global`) |
| Versi | `WORKSPACE_MCP_VERSION` di [src/lib/mcp/workspace-guidance.ts](../../src/lib/mcp/workspace-guidance.ts) | `GLOBAL_MCP_VERSION` di [src/lib/mcp/global-guidance.ts](../../src/lib/mcp/global-guidance.ts) |

Panduan rinci per server:
- [workspace.md](workspace.md): alur membangun dan merilis website workspace.
- [global.md](global.md): alur katalog template, scope token, dan persetujuan.
- [maintenance.md](maintenance.md): cara menambah atau mengubah tool, menaikkan versi, dan menjalankan tes.

## Satu jalur rilis

Website workspace dirilis dengan satu jalur, tanpa pengecualian:

1. `start_preview` (atau `start_website_template_preview` di server Global): buka sandbox preview.
2. `read_preview_file`, `apply_preview_changes`: ubah file di sandbox yang sama.
3. `get_preview_url`, `get_preview_logs`: cek hasilnya di browser.
4. `save_preview_changes`: simpan revisi yang sudah ditinjau.
5. Administrator workspace merilis production dari **Infrastructure → Hosting** (Deploy Production atau Redeploy Production).

`deploy_to_sacms`, `deploy_website_patch`, `deploy_site_version`, dan `rollback_website` membuat kandidat **staging**. Tool itu hanya dipakai kalau pengguna secara eksplisit meminta deploy staging sekali jalan. `promote_deployment` tidak pernah dipanggil agent.

## Auth

- Kedua server menerima `Authorization: Bearer <token>`. Itu cara yang direkomendasikan.
- Kedua server juga menerima `?token=` di URL. Dashboard membuat URL ini hanya untuk ChatGPT, Grok, Generic, dan Claude.ai web, yang tidak punya kolom header. Klien lain harus memakai header.
- Token URL bisa bocor lewat riwayat, screenshot, atau proxy. Kalau curiga bocor, putar tokennya lewat tombol **Putar** di `/developer/mcp`. Token lama langsung tidak berlaku, dan token baru ditampilkan sekali.
- Pemeriksaan log: Caddy di `Caddyfile` tidak punya directive `log`, jadi access log tidak aktif. Route MCP tidak mencatat URL request. Tidak ada jalur log yang memuat query string `?token=`.
- Token global diverifikasi dengan hash SHA-256 dan dicek `expiresAt`. Token tanpa scope valid ditolak.

## Nama tool yang sama di dua server

Empat tool punya nama sama dan maksud sama: `list_field_types`, `list_global_components`, `get_global_component`, dan `get_operation_status` (workspace). Server Global memakai `get_global_operation_status` untuk status operasi background-nya. Nama lama `get_operation_status` di Global tetap ada sebagai alias yang akan dihapus pada rilis major berikutnya.
