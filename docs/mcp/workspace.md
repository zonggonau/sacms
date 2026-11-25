# MCP Workspace (`/api/mcp`)

Written for: agent atau IDE yang menghubungkan website/aplikasi ke satu workspace SaCMS.

## Urutan kerja

Urutan ini sama dengan isi `get_agent_playbook`, yang dibangkitkan dari [src/lib/mcp/workspace-guidance.ts](../../src/lib/mcp/workspace-guidance.ts).

**Fase 0: permintaan membangun atau merevisi**
1. `start_website_build`: daftarkan `runId` agar build bisa dilanjutkan. Kalau percakapan baru merujuk build lama, panggil `get_build_run` dulu.
2. Kalau pengguna ingin mulai dari Website Template katalog, panggil `apply_website_template`. Hanya berjalan di workspace kosong.

**Fase 1: baca schema yang sebenarnya**
3. `get_full_schema`.
4. `list_field_types` sebelum menulis `options` field apa pun.
5. `list_global_components` sebelum membuat komponen dari nol.
6. `list_content_type_groups` kalau workspace punya banyak Content Type.

**Fase 2: baca konten nyata**
7. `query_content` atau `get_single_type` untuk setiap tipe yang relevan.

**Fase 3: bangun frontend**
8. Default stack: Next.js (App Router) + TypeScript + shadcn/ui.
9. Ambil data lewat `get_api_info` (REST/GraphQL) atau `check_sdk_availability` (`@sacms/sdk`).
10. API key untuk frontend: `get_or_create_api_key`. Environment variable pihak ketiga: `list_deployment_env` dulu, `add_deployment_env` kalau belum ada.

**Fase 4: preview dan rilis**
11. `start_preview`, lalu `read_preview_file` dan `apply_preview_changes` dengan `expectedRevision`.
12. `get_preview_url` untuk `accessUrl`, `get_preview_logs` kalau halaman error, `extend_preview` untuk sesi panjang.
13. `save_preview_changes` dengan `expectedSourceVersion`.
14. Berikan link Hosting ke administrator. Administrator yang merilis production.

**Revisi website yang sudah live:** `get_deployment_source` untuk membaca file saat ini, lalu masuk ke Fase 4. Jangan membuat deploy baru dari nol.

## Tool per kelompok

| Kelompok | Tool |
|---|---|
| Pintu masuk | `get_agent_playbook`, `inspect_api_capabilities`, `get_api_info`, `whoami` |
| Schema | `get_full_schema`, `list_field_types`, `*_content_type`, `*_single_type`, `*_component`, `*_content_type_group` |
| Konten | `query_content`, `get_content_entry`, `create_content_entry`, `update_content_entry`, `delete_content_entry` |
| Global Components | `list_global_components`, `get_global_component` |
| Webhook | `*_webhook`, `test_webhook` |
| Preview (jalur utama) | `start_preview`, `get_preview_url`, `read_preview_file`, `apply_preview_changes`, `save_preview_changes`, `get_preview_logs`, `extend_preview`, `stop_preview` |
| Build | `start_website_build`, `get_build_run`, `apply_website_template` |
| Staging (bukan jalur utama) | `deploy_to_sacms`, `deploy_website_patch`, `deploy_site_version`, `rollback_website`, `list_website_versions` |
| Status dan verifikasi | `get_deployment_status`, `get_deployment_build_logs`, `get_deployment_runtime_logs`, `verify_deployment_url`, `get_operation_status` |
| Deployment dan domain | `configure_deployment_domain`, `make_deployment_public`, `add_deployment_env`, `list_deployment_env`, `get_deployment_source` |
| Lainnya | `get_or_create_api_key`, `sync_dev_env`, `check_sdk_availability`, `get_openapi_spec`, `call_external_api` |

Daftar lengkap dan selalu sinkron ada di [tool-manifest.json](tool-manifest.json).

## Yang perlu diingat agent

- Jangan menebak base URL, token, atau domain. Tool sudah menyelesaikannya untuk workspace ini.
- `call_external_api` dengan `{{ENV_KEY}}` memakai secret di sisi server. Jangan memanggil API pihak ketiga langsung dari sandbox.
- `richText` berisi HTML nyata, dan harus dirender dengan sanitasi. `markdown` harus lewat renderer Markdown.
- Mutasi konten lewat jalur validasi dan RBAC yang sama dengan dashboard. Penolakan karena data tidak valid itu wajar.
