# Pemeliharaan server MCP

Written for: engineer yang mengubah tool, guidance, atau auth MCP.

## Di mana sesuatu berada

| Yang diubah | Lokasi |
|---|---|
| Tool workspace | `src/app/api/mcp/[[...transport]]/route.ts` |
| Tool global | `src/app/api/mcp/global-schema/[[...transport]]/route.ts` |
| Preview (keduanya) | `src/lib/infrastructure/mcp-preview.ts` |
| Instruksi dan playbook workspace | `src/lib/mcp/workspace-guidance.ts` |
| Instruksi dan guide global | `src/lib/mcp/global-guidance.ts` |
| Scope token global | `src/lib/mcp-global-scopes.ts` |
| Daftar tool (dibangkitkan) | `docs/mcp/tool-manifest.json` |

Jangan menulis ulang aturan rilis di tempat lain. Playbook, instruksi, deskripsi tool, dan dokumen di folder ini harus merujuk jalur yang sama.

## Menambah atau mengubah tool

1. Tambahkan tool dengan `server.registerTool("nama_tool", …)`.
2. Kalau tool baru di server Global: masukkan namanya ke `READ_TOOLS` atau `DEMO_TOOLS` di `mcp-global-scopes.ts`. Kalau tidak, tool itu butuh `write`.
3. Jalankan `node scripts/mcp-manifest.cjs`. Commit juga `docs/mcp/tool-manifest.json`.
4. Kalau aturan atau alur berubah, perbarui guidance module dan docs terkait.
5. Naikkan versi server (lihat di bawah).
6. Jalankan tes: `bun x vitest run __tests__/api/mcp-* __tests__/lib/mcp-guidance.test.ts`.

## Menaikkan versi

- Tool ditambah, diubah nama, atau dihapus: naikkan **minor** (`4.7.1` → `4.8.0`).
- Hanya perbaikan perilaku tanpa perubahan kontrak: naikkan **patch**.
- Perubahan yang memutus klien (misalnya nama tool dihapus tanpa alias): naikkan **major**, dan tulis di [CHANGELOG.md](../../CHANGELOG.md).

Versi hanya disimpan di `WORKSPACE_MCP_VERSION` atau `GLOBAL_MCP_VERSION`. `serverInfo` di route membacanya dari sana, dan `mcp-tool-manifest.test.ts` memastikan formatnya benar.

## Tes yang menjaga kontrak

| Tes | Menjaga apa |
|---|---|
| `mcp-tool-manifest.test.ts` | Daftar tool sama dengan manifest. Alias dan preview tetap ada. |
| `mcp-guidance.test.ts` | Playbook memakai jalur preview. Instruksi tidak melewati batas panjang Claude Code. |
| `mcp-route-auth.test.ts`, `mcp-global-schema-auth.test.ts` | Auth dan token |
| `mcp-route-tools-contract.test.ts`, `mcp-global-schema-tools-contract.test.ts` | Perilaku tool tertentu |

## Yang belum dipecah

`route.ts` workspace (sekitar 4.800 baris) dan global (sekitar 2.900 baris) masih berisi semua tool inline. Memecahnya per domain perlu tes perilaku per tool, karena tool bergantung pada helper di file yang sama. Itu pekerjaan berikutnya, dan belum dikerjakan di sini.

## Keputusan yang belum diambil

- `?token=` di URL masih diterima. Dashboard `mcp-client.tsx` masih membuatnya untuk klien yang hanya punya kolom URL. Dihapus setelah klien itu punya cara lain.
