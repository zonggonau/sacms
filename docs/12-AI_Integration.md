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
