# MCP Global (`/api/mcp/global-schema`)

Written for: tim SaCMS yang membuat dan merawat katalog Schema Template dan Website Template.

Server ini hanya untuk katalog platform. Workspace pelanggan memakai [MCP Workspace](workspace.md).

## Urutan kerja

Urutan ini adalah ringkasan dari `get_builder_guide` di route global. Instruksi singkat yang dikirim saat connect ada di [src/lib/mcp/global-guidance.ts](../../src/lib/mcp/global-guidance.ts).

1. `get_builder_guide` (pintu masuk) dan `get_website_agent_workflow` (alur lengkap).
2. Analisis brief. Buat atau pakai ulang workspace demo internal (`list_schema_templates`, `get_schema_template`).
3. `list_field_types` sebelum menulis field apa pun.
4. `create_schema_template` atau `update_schema_template` dengan `expectedVersion`.
5. `create_website_template` dengan `dryRun: true` dulu. Dry run memvalidasi seluruh bundle tanpa membuat atau men-deploy apa pun.
6. Buat sungguhan. Demo berjalan dengan `get_website_template_demo_status`.
7. Verifikasi preview: `start_website_template_preview`, `get_website_template_preview`, `read_preview_file`, `get_preview_logs`.
8. Publikasi (`published: true`) dan `isDefault: true` tidak pernah langsung berlaku. Keduanya masuk ke `/admin/developer/approvals`. Pakai `get_approval_status` untuk memeriksa.

## Scope token

Scope dipetakan di [src/lib/mcp-global-scopes.ts](../../src/lib/mcp-global-scopes.ts). Setiap scope otomatis menyertakan `read`.

| Scope | Boleh |
|---|---|
| `read` | Tool baca, status, dan guide |
| `demo` | Plus konten demo internal |
| `write` | Plus membuat, mengubah, dan menghapus template dan Global Component |
| `publish` | Plus meminta publikasi, `isDefault`, dan cascade delete. Tetap menunggu persetujuan manusia |

Tool yang tidak terdaftar di peta scope **membutuhkan `write`**. Ini sengaja fail-closed: tool baru tidak otomatis bisa dipanggil oleh token baca saja.

Token lama tanpa scope (`schema-template`) tetap punya akses penuh, supaya integrasi lama tidak putus.

## Persetujuan

Publikasi, `isDefault`, dan cascade delete tidak pernah diterapkan langsung oleh agent. Item disimpan tanpa perubahan itu, dan permintaannya muncul di `pendingApprovals`. Super admin menyetujui atau menolak di `/admin/developer/approvals`. Agent memberi tahu pengguna bahwa permintaan sedang menunggu.
