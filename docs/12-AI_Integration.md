# SaCMS AI & Model Context Protocol (MCP) Integration

**Baseline:** 23 Agustus 2026 (v1.2.1.0)  
**Tujuan:** Mendokumentasikan arsitektur integrasi AI, generator skema otomatis berbasis domain, protokol asisten coding MCP, dan exporter starter project.

---

## 1. Arsitektur AI Engine SaCMS

SaCMS mengintegrasikan kapabilitas AI generatif ke dalam dua domain utama:
1. **Content & Schema Generation (Dashboard):** Membantu editor dan arsitek data merancang skema dan mengisi konten entri dalam hitungan detik.
2. **Model Context Protocol (Developer & AI Coding Assistants):** Membuka akses aman bagi AI Agent (Cursor, Windsurf, Claude Code) untuk membaca skema, mengueri konten, dan membuat entri draft secara terprogram.

```
┌──────────────────────────────────────────────┐
│        AI Coding Assistant (Cursor / IDE)    │
└──────────────────────┬───────────────────────┘
                       │ (MCP SSE/HTTP Protocol)
                       ▼
┌──────────────────────────────────────────────┐
│  /api/mcp/[[...transport]] (MCP Server)     │
│  - Token Check (SHA-256)                     │
│  - Tool Calling: schema, content, entry      │
└──────────────────────┬───────────────────────┘
                       ▼
┌──────────────────────────────────────────────┐
│  AI Schema Engine (src/lib/ai/schema-engine) │
│  - Domain Blueprints (Hotel, News, Agency)   │
│  - Zod v4 Dynamic Schema Generator           │
│  - Starter Project Exporter (Next.js 16 ZIP) │
└──────────────────────────────────────────────┘
```

---

## 2. Model Context Protocol (MCP) Server

SaCMS menyediakan endpoint native MCP di `/api/mcp/[[...transport]]`.

### 2.1 Konfigurasi di Cursor / Windsurf (`mcp.json`):
```json
{
  "mcpServers": {
    "sacms": {
      "url": "https://cms.yourdomain.com/api/mcp",
      "headers": {
        "Authorization": "Bearer cf_mcp_live_xxxxxxxxxxxxxxxx"
      }
    }
  }
}
```

### 2.2 Tools MCP yang Disediakan:
1. `sacms_list_content_types`: Mendapatkan daftar semua Content Type aktif beserta slug-nya.
2. `sacms_get_schema`: Membaca detail field, tipe data, validasi, dan relasi dari sebuah Content Type.
3. `sacms_query_content`: Mengambil data entri konten dengan filter dan pagination.
4. `sacms_create_entry`: Menambahkan draft konten baru ke dalam CMS.

---

## 3. AI Schema Engine & Domain Blueprints

Engine di `src/lib/ai/schema-engine.ts` dan `src/lib/ai/domain-knowledge.ts` menyediakan blueprint skema instan untuk berbagai industri:
- **E-Commerce:** Produk, Kategori, Varian, Review, Diskon, Inventaris.
- **Hospitality & Hotel:** Tipe Kamar, Fasilitas, Reservasi, Review Tamu, Lokasi.
- **News & Media:** Artikel, Kategori, Penulis, Tag, Galeri Foto, Editorial.
- **Digital Agency:** Portofolio Proyek, Layanan, Testimonial, Anggota Tim, Studi Kasus.

**Endpoint AI Schema:**
- `POST /api/tenant/[tenant]/ai-builder/plan-schema`: Menghasilkan rancangan skema dari prompt natural language.
- `POST /api/tenant/[tenant]/ai-builder/export-starter`: Mengunduh kode frontend Next.js 16 + TailwindCSS v4 siap pakai yang langsung terhubung ke skema tersebut.

---

## 4. Fitur Content Generation di Dashboard

| Fitur | Endpoint | Deskripsi |
|---|---|---|
| **Smart Fill** | `/api/tenant/[tenant]/ai/smart-fill` | Mengisi seluruh field entry secara otomatis dari deskripsi singkat |
| **Translate** | `/api/tenant/[tenant]/ai/translate` | Menerjemahkan konten ke locale tujuan secara kontekstual |
| **Summarize** | `/api/tenant/[tenant]/ai/summarize` | Membuat ringkasan artikel dan meta deskripsi SEO otomatis |
| **Component Gen** | `/api/tenant/[tenant]/ai/generate-component` | Membuat isi field dinamis berbasis komponen |

---

## 5. Quota & Credit Ledger

Pemakaian token AI dicatat secara transparan pada model `AiQuotaLedger` per-tenant. Super Admin dapat mengatur kuota bulanan per tier paket atau menambahkan kuota tambahan (*Add-on AI Credits*).

---

## 6. AI Website Builder (`/aibuilder`)

Selain Content/Schema Generation dan MCP, SaCMS memiliki fitur inti ketiga: **AI Website Builder**, sebuah shell full-screen bergaya "v0 Studio" (`src/components/ai-builder/aibuilder-shell.tsx`, `aibuilder-sidebar.tsx`, `aibuilder-projects-view.tsx`, `v0-top-navbar.tsx`) yang dipasang di route `/aibuilder`. Ini adalah fitur permanen dan terus dikembangkan — bukan produk terpisah dan bukan kandidat penghapusan (lihat `docs/archive/16-...md` untuk riwayat rencana pemisahan yang sudah dibatalkan).

Mesin generasinya (`WebsiteBuilderClient`, di `src/app/(workspace)/dashboard/[tenant]/(dashboard)/content-type-builder/aiwebsitebuilder/website-builder-client.tsx`) dipakai ulang oleh shell `/aibuilder`.

**Dua jalur model:**
- **Model v0** — memakai v0 streaming SDK asli: `useChat` (`@ai-sdk/react`) + `V0Transport` (`@v0-sdk/react`), lewat rute proxy `POST /api/tenant/[tenant]/ai-builder/v0/chats/stream` (pesan pertama), `v0/chats/[chatId]/messages/stream` (lanjutan), `v0/chats/[chatId]/resume` (sambung ulang), `v0/register` (simpan `chatId` di tengah stream), `v0/finalize` (pasca-stream: ambil file dengan retry, sinkronkan `Site`/`SiteFile`, deploy ke Vercel), `v0/chats/[chatId]/files` (cek ulang manual), `v0/chats/[chatId]/preview-url` (URL preview baru).
- **Model Claude** (id berawalan `claude-`) — tidak punya ekivalen v0-SDK; tetap memakai rute REST sinkron lama `ai-builder/generate-frontend` dan `ai-builder/iterate`.

Situs yang digenerate menerima `.env.local` nyata (bukan token literal ter-hardcode) via `resolveFrontendEnv()` di `src/lib/infrastructure/frontend-env.ts` — set env yang sama dipakai tombol Deploy di panel Hosting: `NEXT_PUBLIC_SACMS_API_URL`, `NEXT_PUBLIC_SACMS_TENANT`, `SACMS_API_KEY` (server-only). Mega-prompt v0 mengarahkan agar kode yang dihasilkan membaca `process.env.*` alih-alih hardcode. Env yang sama didorong ke Vercel lewat `deployToVercel(..., envVars)` dan `pushEnvToVercelProject()` saat deploy.

**Dua jenis pengguna self-registrasi** menentukan siapa yang mendarat di `/aibuilder`: akun `role: "user"` (default, checkbox developer di form register tidak dicentang) auto-provisioned workspace dan mendarat di `/aibuilder` setelah login tanpa perlu paham CMS; akun `role: "developer"` (checkbox dicentang) mendarat di `/dashboard` (hub lintas-workspace) atau langsung di `/developer/{tenant}` kalau cuma punya satu workspace, lalu mengelola skema/API di `/developer/{tenant}` dan konten di `/cms/{tenant}`.
