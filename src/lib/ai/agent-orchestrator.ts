/**
 * SaCMS Autonomous AI Agent Orchestrator
 *
 * Coordinates 2-Phase autonomous generation:
 * 1. CMS Schema Architect (MCP Tools execution & initial mock entries)
 * 2. Next.js Frontend Engineer (Virtual project files generation with SaCMS API connection)
 */

import { db } from "@/lib/database"
import { McpClientBridge } from "@/lib/mcp/mcp-client-bridge"
import { computeSchemaDiff, applySchemaPlan, SchemaPlan, WebsitePlan } from "@/lib/ai/schema-engine"
import { generateFullWebsiteProject } from "@/lib/ai/website-generator"
import { createV0Chat, getV0Preview, resolveV0ApiKey, iterateV0ChatReal, normalizeV0Model } from "@/lib/v0-client"
import { ModelRouter } from "@/lib/ai/model-router"

export interface AgentStepEvent {
  step: "analyzing" | "mcp_inspect" | "schema_plan" | "schema_apply" | "code_gen" | "saving" | "completed" | "error"
  message: string
  details?: any
}

export interface OrchestrationResult {
  success: boolean
  schemaDiff?: any
  createdTypes?: string[]
  updatedFiles: Array<{ path: string; content: string }>
  creditsUsed: number
  summary: string
  error?: string
  usedV0Sdk?: boolean
  v0ChatId?: string | null
  v0PreviewUrl?: string | null
  mode?: "create" | "iterate"
  model?: string
  changedFiles?: string[]
}

export interface PipelineOptions {
  /** v0 model id: v0-mini | v0-pro | v0-max | v0-max-fast */
  model?: string
  /** Ignore the existing v0 chat and start a brand-new generation. */
  forceNew?: boolean
}

const V0_SYSTEM_PROMPT = [
  "You build websites that are rendered inside the SaCMS AI Website Builder.",
  "Stack: Next.js App Router (React 19, TypeScript), Tailwind CSS, lucide-react icons. No other npm packages.",
  "Content comes from the SaCMS headless API via `import { getCollection, getSingleType } from \"@/lib/sacms\"`.",
  "Always produce responsive, accessible, visually polished UI. Keep existing structure when editing; change only what the user asks.",
].join(" ")

export class AgentOrchestrator {
  private bridge: McpClientBridge

  constructor(
    public readonly tenantId: string,
    public readonly tenantSlug: string,
    public readonly siteId: string,
    public readonly userId?: string
  ) {
    this.bridge = new McpClientBridge(tenantId, tenantSlug)
  }

  /**
   * Run the end-to-end Autonomous Website Builder Pipeline
   */
  async runPipeline(
    prompt: string,
    onStep?: (event: AgentStepEvent) => void,
    options?: PipelineOptions
  ): Promise<OrchestrationResult> {
    const model = normalizeV0Model(options?.model)

    // 0. Existing v0 chat? -> iterate on it (v0.app-style follow-up) instead of rebuilding everything.
    const siteState = await db.site.findUnique({ where: { id: this.siteId }, select: { settings: true } })
    const existingSettings = ((siteState?.settings as Record<string, unknown> | null) || {}) as Record<string, unknown>
    const existingChatId = typeof existingSettings.v0ChatId === "string" ? existingSettings.v0ChatId : null
    if (existingChatId && !existingChatId.startsWith("sacms_gen_") && !options?.forceNew) {
      return this.runIteration(prompt, existingChatId, existingSettings, model, onStep)
    }

    // 1. Check AI Credits
    const creditCheck = await ModelRouter.checkCredits(this.tenantId, this.userId, "full_website_generation")
    if (!creditCheck.allowed) {
      onStep?.({ step: "error", message: creditCheck.error || "Kredit tidak mencukupi" })
      return { success: false, updatedFiles: [], creditsUsed: 0, summary: "", error: creditCheck.error }
    }

    // ── STEP 1: Inspect existing workspace schema & API capabilities via MCP ──
    onStep?.({ step: "mcp_inspect", message: "Menginspeksi hak akses & skema SaCMS melalui MCP (inspect_api_capabilities, get_full_schema)..." })
    const [capabilities, currentSchema] = await Promise.all([
      this.bridge.inspectApiCapabilities(),
      this.bridge.getFullSchema(),
    ])

    // ── STEP 2: Generate Schema Plan based on prompt ─────────────────────────
    onStep?.({ step: "schema_plan", message: "Merancang arsitektur Content Types & Components..." })
    const schemaPlan = this.synthesizeSchemaPlan(prompt)

    // ── STEP 3: Compute Schema Diff ──────────────────────────────────────────
    const schemaDiff = computeSchemaDiff(currentSchema, schemaPlan)
    onStep?.({
      step: "schema_apply",
      message: `Menerapkan perubahan skema melalui MCP (+${schemaDiff.creates.length} tipe baru)...`,
      details: schemaDiff,
    })

    // ── STEP 4: Apply Schema Changes & Populate Mock Entries ─────────────────
    const schemaResults = await applySchemaPlan(this.bridge, schemaPlan, (msg) => {
      onStep?.({ step: "schema_apply", message: msg })
    })

    // ── STEP 5: Generate Next.js Frontend Code Files (v0 SDK Integration) ──
    let generatedFiles: Array<{ path: string; content: string }> = []
    let v0ChatId: string | null = null
    let v0PreviewUrl: string | null = null
    let usedV0Sdk = false

    const v0Key = await resolveV0ApiKey()

    if (v0Key) {
      onStep?.({ step: "code_gen", message: "Menghubungi v0 SDK untuk meng-generate arsitektur frontend di v0.app/sa-cms..." })
      try {
        const siteRecord = await db.site.findUnique({ where: { id: this.siteId }, select: { name: true, slug: true, description: true } })
        const chatTitle = `SaCMS - ${siteRecord?.name || this.tenantSlug}`

        const superPrompt = `You are an expert Next.js 16 full-stack engineer. Build a complete, production-ready, beautiful, modern website frontend for the following project.

### USER REQUIREMENTS
${prompt}

### ARCHITECTURE & DESIGN GOALS
1. Use Next.js 16 App Router (React 19, TypeScript, Tailwind CSS, Lucide React icons).
2. Create an engaging, modern, high-contrast, premium dark-themed or clean UI with glassmorphism touches, responsive mobile/tablet/desktop layouts, and interactive micro-interactions.
3. Include all necessary interactive elements: Search input filters, category tabs, detail/booking/cart modals, responsive navbar, hero banner, rich data showcase cards, feature highlights, and footer.
4. Seamless integration with the SaCMS Content API:
   - Data can be fetched dynamically from the SaCMS Content API.
   - You can import and use:
     \`import { getCollection, getSingleType } from "@/lib/sacms"\`
   - Or make direct fetch calls to:
     \`http://localhost:3000/api/public/${this.tenantSlug}/content/{collectionSlug}\`

### SaCMS DATABASE SCHEMA (Active Collections & Single Types)
${JSON.stringify(schemaPlan, null, 2)}

### SaCMS CAPABILITIES (MCP)
- Permissions: ${Array.isArray(capabilities.permissions) ? (capabilities.permissions as string[]).join(", ") : "read, write"}
- Mode: ${capabilities.canWrite ? "Interactive Full-Stack (include forms & mutations)" : "Public Consumer (read-only presentation)"}

### MANDATORY FILES TO GENERATE
1. app/page.tsx: The main landing & home page component (complete code, with imports, state, and UI).
2. Additional components in components/ if needed.
3. Ensure all icons are imported from 'lucide-react'.
4. Do NOT use external API dependencies or missing packages. Ensure code is 100% syntactically valid TypeScript/JSX.`

        const v0Res = await createV0Chat(superPrompt, model, {
          apiKey: v0Key,
          waitForFiles: true,
          maxWaitSeconds: 60,
          systemPrompt: V0_SYSTEM_PROMPT,
          title: chatTitle,
          privacy: "team",
          metadata: {
            tenantId: this.tenantId,
            tenantSlug: this.tenantSlug,
            siteId: this.siteId,
          },
          onProgress: (statusMsg) => {
            onStep?.({ step: "code_gen", message: statusMsg })
          },
        })

        if (v0Res?.chatId && !v0Res.usedFallback) {
          v0ChatId = v0Res.chatId
          v0PreviewUrl = v0Res.previewUrl || null
          usedV0Sdk = true

          if (v0Res.files && v0Res.files.length > 0) {
            generatedFiles = v0Res.files.map((vf) => {
              const normalizedPath = vf.name.startsWith("/") ? vf.name.slice(1) : vf.name
              return {
                path: normalizedPath,
                content: vf.content,
              }
            })
          }
        }
      } catch (v0Err: any) {
        console.warn("v0 SDK error, falling back to SaCMS engine:", v0Err?.message)
      }
    }

    // Fallback if V0_API_KEY is not set or v0 returned empty files
    if (generatedFiles.length === 0) {
      if (!v0Key) {
        onStep?.({ step: "code_gen", message: "API Key SaCMS AI Engine belum dikonfigurasi. Menggunakan SaCMS Next.js Autonomous Generator..." })
      } else {
        onStep?.({ step: "code_gen", message: "SaCMS AI Engine tidak mengembalikan berkas. Menggunakan SaCMS Next.js Generator (fallback)..." })
      }
      const siteRecord = await db.site.findUnique({ where: { id: this.siteId }, select: { name: true, slug: true, description: true } })
      generatedFiles = generateFullWebsiteProject({
        tenantId: this.tenantId,
        tenantSlug: this.tenantSlug,
        siteName: siteRecord?.name || "Website",
        siteSlug: siteRecord?.slug || "site",
        description: siteRecord?.description || undefined,
        plan: schemaPlan,
      })
    }

    // Ensure lib/sacms.ts is always present in virtual workspace
    if (!generatedFiles.some((f) => f.path === "lib/sacms.ts" || f.path === "/lib/sacms.ts")) {
      generatedFiles.push({
        path: "lib/sacms.ts",
        content: `/**
 * SaCMS Content API Client
 * Workspace: ${this.tenantSlug}
 */

const SACMS_HOST = process.env.NEXT_PUBLIC_SACMS_URL || "http://localhost:3000";
const TENANT_ID = "${this.tenantId}";

export async function getCollection<T = any>(contentTypeSlug: string, params: Record<string, string> = {}): Promise<T[]> {
  try {
    const query = new URLSearchParams(params).toString();
    const url = \`\${SACMS_HOST}/api/public/\${TENANT_ID}/content/\${contentTypeSlug}\${query ? '?' + query : ''}\`;
    const res = await fetch(url, { next: { revalidate: 60 } });
    if (!res.ok) return [];
    const json = await res.json();
    return json.data || json.entries || [];
  } catch (e) {
    console.error(\`Failed to fetch collection \${contentTypeSlug}:\`, e);
    return [];
  }
}

export async function getSingleType<T = any>(singleTypeSlug: string): Promise<T | null> {
  try {
    const url = \`\${SACMS_HOST}/api/public/\${TENANT_ID}/single/\${singleTypeSlug}\`;
    const res = await fetch(url, { next: { revalidate: 60 } });
    if (!res.ok) return null;
    const json = await res.json();
    return json.data || null;
  } catch (e) {
    console.error(\`Failed to fetch single type \${singleTypeSlug}:\`, e);
    return null;
  }
}
`,
      })
    }

    // ── STEP 6: Save Files to Virtual Filesystem in Database ─────────────────
    onStep?.({ step: "saving", message: "Menyimpan berkas ke virtual workspace..." })
    for (const f of generatedFiles) {
      await db.siteFile.upsert({
        where: {
          siteId_path: { siteId: this.siteId, path: f.path },
        },
        create: {
          siteId: this.siteId,
          path: f.path,
          content: f.content,
        },
        update: {
          content: f.content,
        },
      })
    }

    // Update site status to active with engine and preview info
    await db.site.update({
      where: { id: this.siteId },
      data: {
        status: "published",
        previewUrl: v0PreviewUrl || `https://v0.app/chat/${v0ChatId}`,
        settings: {
          ...existingSettings,
          v0ChatId: v0ChatId || undefined,
          engine: usedV0Sdk ? "v0-sdk" : "sacms-engine",
          model,
          v0ProjectUrl: v0ChatId ? `https://v0.app/chat/${v0ChatId}` : undefined,
          v0TeamUrl: "https://v0.app/sa-cms",
        } as any,
        updatedAt: new Date(),
      },
    })

    // ── STEP 7: Deduct AI Credits & Record Ledger ────────────────────────────
    const creditsUsed = 30
    await ModelRouter.deductCredits(this.tenantId, this.userId, "full_website_generation", creditsUsed, {
      prompt,
      createdContentTypes: schemaResults.createdContentTypes,
    })

    const summary = usedV0Sdk
      ? `Berhasil merancang ${schemaResults.createdContentTypes.length} Content Types dan meng-generate frontend Next.js 16 via SaCMS AI Engine (${generatedFiles.length} berkas).`
      : `Berhasil merancang ${schemaResults.createdContentTypes.length} Content Types dan meng-generate halaman Next.js dinamis.`
    onStep?.({ step: "completed", message: "Website berhasil dibangun dan siap di-preview!" })

    return {
      success: true,
      schemaDiff,
      createdTypes: schemaResults.createdContentTypes,
      updatedFiles: generatedFiles,
      creditsUsed,
      summary,
      usedV0Sdk,
      v0ChatId,
      v0PreviewUrl,
      mode: "create",
      model,
    }
  }

  /**
   * v0.app-style follow-up: send the instruction to the SAME v0 chat and sync only what v0 changed.
   * Skips schema planning/mutation entirely (cheap: `section_edit` credits).
   */
  private async runIteration(
    prompt: string,
    chatId: string,
    existingSettings: Record<string, unknown>,
    model: string,
    onStep?: (event: AgentStepEvent) => void
  ): Promise<OrchestrationResult> {
    const fail = (error: string): OrchestrationResult => {
      onStep?.({ step: "error", message: error })
      return { success: false, updatedFiles: [], creditsUsed: 0, summary: "", error, mode: "iterate", model }
    }

    const creditCheck = await ModelRouter.checkCredits(this.tenantId, this.userId, "section_edit")
    if (!creditCheck.allowed) return fail(creditCheck.error || "Kredit tidak mencukupi")

    onStep?.({ step: "analyzing", message: `Melanjutkan iterasi project di v0.app/sa-cms (${model})...` })
    const res = await iterateV0ChatReal(chatId, prompt, {
      model,
      systemPrompt: V0_SYSTEM_PROMPT,
      maxWaitSeconds: 90,
      privacy: "team",
      onProgress: (message) => onStep?.({ step: "code_gen", message }),
    })

    if (res.v0Error) return fail(`SaCMS Engine: ${res.v0Error}`)

    if (!res.changed) {
      onStep?.({ step: "completed", message: "AI Engine belum mengembalikan perubahan kode." })
      return {
        success: true,
        updatedFiles: [],
        creditsUsed: 0,
        summary:
          "AI Engine belum menghasilkan perubahan kode dalam batas waktu. Instruksi mungkin masih diproses — klik **Reload** pada preview beberapa saat lagi, atau perjelas instruksi Anda.",
        usedV0Sdk: true,
        v0ChatId: chatId,
        mode: "iterate",
        model,
        changedFiles: [],
      }
    }

    onStep?.({ step: "saving", message: "Menyinkronkan berkas yang berubah ke virtual workspace..." })
    const existing = await db.siteFile.findMany({ where: { siteId: this.siteId }, select: { path: true, content: true } })
    const existingMap = new Map(existing.map((f) => [f.path, f.content]))
    const changedFiles: string[] = []
    for (const vf of res.files) {
      const path = vf.name.startsWith("/") ? vf.name.slice(1) : vf.name
      if (existingMap.get(path) === vf.content) continue
      changedFiles.push(path)
      await db.siteFile.upsert({
        where: { siteId_path: { siteId: this.siteId, path } },
        create: { siteId: this.siteId, path, content: vf.content },
        update: { content: vf.content },
      })
    }

    await db.site.update({
      where: { id: this.siteId },
      data: {
        status: "published",
        previewUrl: `https://v0.app/chat/${chatId}`,
        settings: {
          ...existingSettings,
          v0ChatId: chatId,
          model,
          v0ProjectUrl: `https://v0.app/chat/${chatId}`,
          v0TeamUrl: "https://v0.app/sa-cms",
          lastIteratedAt: new Date().toISOString(),
        } as any,
        updatedAt: new Date(),
      },
    })

    const creditsUsed = 2
    await ModelRouter.deductCredits(this.tenantId, this.userId, "section_edit", creditsUsed, { prompt, changedFiles })

    const allFiles = await db.siteFile.findMany({ where: { siteId: this.siteId }, orderBy: { path: "asc" }, select: { path: true, content: true } })
    onStep?.({ step: "completed", message: `Selesai — ${changedFiles.length} berkas diperbarui.` })

    return {
      success: true,
      updatedFiles: allFiles,
      creditsUsed,
      summary: `Perubahan diterapkan lewat SaCMS AI Engine (${model}). ${changedFiles.length} berkas diperbarui: ${changedFiles.map((p) => `\`${p}\``).join(", ") || "-"}.`,
      usedV0Sdk: true,
      v0ChatId: chatId,
      mode: "iterate",
      model,
      changedFiles,
    }
  }

  /**
   * Domain-aware Schema Plan Synthesizer
   */
  private synthesizeSchemaPlan(prompt: string): SchemaPlan {
    const p = prompt.toLowerCase()

    if (p.includes("hotel") || p.includes("kamar") || p.includes("resort") || p.includes("penginapan")) {
      return {
        summary: "Arsitektur Website Hotel & Resor dengan Manajemen Kamar dan Booking",
        contentTypes: [
          {
            name: "Room",
            slug: "rooms",
            description: "Daftar tipe kamar hotel, harga, dan fasilitas",
            fields: [
              { name: "Nama Kamar", slug: "title", type: "text", required: true },
              { name: "Harga per Malam", slug: "price", type: "number", required: true },
              { name: "Kapasitas Tamu", slug: "capacity", type: "text", required: true },
              { name: "Deskripsi", slug: "description", type: "richText" },
              { name: "Foto Kamar", slug: "image", type: "media" },
              { name: "Fasilitas Unggulan", slug: "features", type: "text" },
            ],
            mockEntries: [
              { title: "Deluxe Ocean View", price: 1250000, capacity: "2 Dewasa", features: "King Bed, Balcony, WiFi, Bathtub" },
              { title: "Executive Suite Nabire", price: 2100000, capacity: "4 Tamu", features: "Living Room, Jacuzzi, Ocean Panorama" },
              { title: "Standard Garden Villa", price: 850000, capacity: "2 Dewasa", features: "Queen Bed, Garden View, Breakfast" },
            ],
          },
          {
            name: "Facility",
            slug: "facilities",
            description: "Fasilitas hotel seperti kolam renang, restoran, dan gym",
            fields: [
              { name: "Nama Fasilitas", slug: "name", type: "text", required: true },
              { name: "Jam Operasional", slug: "hours", type: "text" },
              { name: "Deskripsi", slug: "description", type: "text" },
            ],
            mockEntries: [
              { name: "Infinity Pool Teluk Cenderawasih", hours: "06:00 - 21:00", description: "Kolam renang air hangat dengan pemandangan langsung ke laut" },
              { name: "Cenderawasih Seafood Resto", hours: "07:00 - 23:00", description: "Sajian kuliner khas pesisir Papua dan menu internasional" },
            ],
          },
        ],
        singleTypes: [
          {
            name: "Hotel Settings",
            slug: "hotel-settings",
            description: "Pengaturan umum hotel, alamat, dan kontak",
            fields: [
              { name: "Nama Hotel", slug: "hotelName", type: "text", required: true },
              { name: "Alamat", slug: "address", type: "text" },
              { name: "Nomor WhatsApp", slug: "phone", type: "text" },
              { name: "Email Reservasi", slug: "email", type: "text" },
            ],
          },
        ],
        components: [
          {
            name: "RoomCard",
            slug: "room-card",
            fields: [
              { name: "Badge", slug: "badge", type: "text" },
              { name: "Rating", slug: "rating", type: "number" },
            ],
          },
        ],
      }
    }

    if (p.includes("toko") || p.includes("store") || p.includes("produk") || p.includes("ecommerce") || p.includes("noken")) {
      return {
        summary: "Arsitektur E-Commerce / Toko Online Produk & Kerajinan",
        contentTypes: [
          {
            name: "Product",
            slug: "products",
            description: "Katalog produk dan stok",
            fields: [
              { name: "Judul Produk", slug: "title", type: "text", required: true },
              { name: "Sub-judul / Asal", slug: "subtitle", type: "text" },
              { name: "Harga (Rp)", slug: "price", type: "number", required: true },
              { name: "Kategori", slug: "category", type: "text" },
              { name: "Foto Cover", slug: "cover_image", type: "media" },
              { name: "Deskripsi Produk", slug: "content", type: "richText" },
              { name: "Stok", slug: "stock", type: "number" },
            ],
            mockEntries: [
              { title: "Noken Asli Kulit Kayu Nabire", subtitle: "Serat Kayu Alami", price: 350000, category: "Kerajinan", stock: 15, cover_image: "https://images.unsplash.com/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&w=1200&q=80", content: "<p>Noken anyaman tangan tradisional.</p>" },
              { title: "Kopi Arabika Moanemani 250g", subtitle: "Single Origin 1.800 mdpl", price: 85000, category: "Kuliner", stock: 50, cover_image: "https://images.unsplash.com/photo-1559056199-641a0ac8b55e?auto=format&fit=crop&w=1200&q=80", content: "<p>Kopi arabika organik pegunungan tengah.</p>" },
              { title: "Batik Papua Motif Cenderawasih", subtitle: "Batik Sutra Halus", price: 275000, category: "Pakaian", stock: 20, cover_image: "https://images.unsplash.com/photo-1558769132-cb1aea458c5e?auto=format&fit=crop&w=1200&q=80", content: "<p>Kain batik khas Papua motif cenderawasih.</p>" },
            ],
          },
        ],
        singleTypes: [
          {
            name: "Store Settings",
            slug: "store-settings",
            fields: [
              { name: "Judul Utama (Hero Title)", slug: "hero_title", type: "text" },
              { name: "Sub-judul (Hero Subtitle)", slug: "hero_subtitle", type: "text" },
              { name: "Deskripsi Toko", slug: "content", type: "richText" },
              { name: "Nomor WhatsApp", slug: "whatsapp", type: "text" },
              { name: "Email Toko", slug: "email", type: "text" },
              { name: "Alamat Toko", slug: "address", type: "text" },
            ],
          },
        ],
        components: [],
      }
    }

    // Default Dynamic General Website Plan
    return {
      summary: "Arsitektur Website Profil Dinamis Terhubung SaCMS",
      contentTypes: [
        {
          name: "Article",
          slug: "articles",
          description: "Artikel berita, blog, dan publikasi",
          fields: [
            { name: "Judul Berita", slug: "title", type: "text", required: true },
            { name: "Sub-judul / Ringkasan", slug: "subtitle", type: "text" },
            { name: "Foto Cover", slug: "cover_image", type: "media" },
            { name: "Isi Konten Lengkap", slug: "content", type: "richText" },
            { name: "Penulis", slug: "author", type: "text" },
          ],
          mockEntries: [
            { title: "Transformasi Digital dan Inovasi Terbaru", subtitle: "Membangun ekosistem web modern berbasis SaCMS", cover_image: "https://images.unsplash.com/photo-1541888946425-d0fbb18086f6?auto=format&fit=crop&w=1200&q=80", content: "<p>Membangun ekosistem web modern berbasis SaCMS Headless CMS.</p>", author: "Admin" },
            { title: "Peluncuran Layanan Terbaru Tahun Ini", subtitle: "Peningkatan kualitas infrastruktur digital", cover_image: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1200&q=80", content: "<p>Peningkatan kualitas infrastruktur digital terdesentralisasi.</p>", author: "Tim Editor" },
          ],
        },
      ],
      singleTypes: [
        {
          name: "Company Settings",
          slug: "company-settings",
          fields: [
            { name: "Judul Utama (Hero Title)", slug: "hero_title", type: "text" },
            { name: "Sub-judul (Hero Subtitle)", slug: "hero_subtitle", type: "text" },
            { name: "Deskripsi Perusahaan", slug: "content", type: "richText" },
            { name: "Nomor WhatsApp", slug: "whatsapp", type: "text" },
            { name: "Email Resmi", slug: "email", type: "text" },
            { name: "Alamat Kantor", slug: "address", type: "text" },
          ],
        },
      ],
      components: [],
    }
  }

  /**
   * Next.js App Router Project Generator
   */
  private generateNextJsProjectFiles(prompt: string, plan: SchemaPlan): Array<{ path: string; content: string }> {
    const isHotel = (plan.contentTypes || []).some((c) => c.slug === "rooms")
    const isStore = (plan.contentTypes || []).some((c) => c.slug === "products")

    const files: Array<{ path: string; content: string }> = []

    // 1. lib/sacms.ts
    files.push({
      path: "lib/sacms.ts",
      content: `/**
 * SaCMS Content API Client
 * Workspace: ${this.tenantSlug}
 */

const SACMS_HOST = process.env.NEXT_PUBLIC_SACMS_URL || "http://localhost:3000";
const TENANT_ID = "${this.tenantId}";

export async function getCollection<T = any>(contentTypeSlug: string, params: Record<string, string> = {}): Promise<T[]> {
  try {
    const query = new URLSearchParams(params).toString();
    const url = \`\${SACMS_HOST}/api/public/\${TENANT_ID}/content/\${contentTypeSlug}\${query ? '?' + query : ''}\`;
    const res = await fetch(url, { next: { revalidate: 60 } });
    if (!res.ok) return [];
    const json = await res.json();
    return json.data || json.entries || [];
  } catch (e) {
    console.error(\`Failed to fetch collection \${contentTypeSlug}:\`, e);
    return [];
  }
}

export async function getSingleType<T = any>(singleTypeSlug: string): Promise<T | null> {
  try {
    const url = \`\${SACMS_HOST}/api/public/\${TENANT_ID}/single/\${singleTypeSlug}\`;
    const res = await fetch(url, { next: { revalidate: 60 } });
    if (!res.ok) return null;
    const json = await res.json();
    return json.data || null;
  } catch (e) {
    console.error(\`Failed to fetch single type \${singleTypeSlug}:\`, e);
    return null;
  }
}`,
    })

    // 2. app/page.tsx
    if (isHotel) {
      files.push({
        path: "app/page.tsx",
        content: `import { getCollection } from "@/lib/sacms";
import { Bed, Users, Star, ArrowRight, ShieldCheck, MapPin, Sparkles, Phone, Mail } from "lucide-react";

export default async function HotelHomePage() {
  const rooms = await getCollection("rooms");

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 font-sans">
      {/* Navigation */}
      <header className="border-b border-slate-800/80 bg-slate-950/80 backdrop-blur sticky top-0 z-50 px-6 py-4 flex items-center justify-between max-w-7xl mx-auto">
        <div className="flex items-center gap-2">
          <Star className="h-5 w-5 text-amber-400 fill-amber-400" />
          <span className="font-extrabold text-base tracking-tight text-white">Grand Resort Nabire</span>
        </div>
        <nav className="hidden md:flex items-center gap-6 text-xs font-semibold text-slate-300">
          <a href="#rooms" className="hover:text-amber-400 transition-colors">Pilihan Kamar</a>
          <a href="#facilities" className="hover:text-amber-400 transition-colors">Fasilitas</a>
          <a href="#contact" className="hover:text-amber-400 transition-colors">Kontak & Reservasi</a>
        </nav>
        <button className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-xs transition-colors">
          Booking Sekarang
        </button>
      </header>

      {/* Hero Section */}
      <section className="relative py-20 px-6 text-center max-w-5xl mx-auto space-y-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-amber-500/30 bg-amber-500/10 text-xs font-semibold text-amber-400">
          <Sparkles className="h-3.5 w-3.5" />
          Resor Mewah Pesisir Teluk Cenderawasih
        </div>
        <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-white leading-tight">
          Ketenangan Sejati di Jantung Nabire Papua
        </h1>
        <p className="text-slate-400 text-base md:text-lg max-w-2xl mx-auto">
          Nikmati perpaduan kemewahan modern dengan keindahan alam eksotis Nabire. Fasilitas kamar bintang 5 siap menyambut liburan Anda.
        </p>
      </section>

      {/* Rooms Catalog */}
      <section id="rooms" className="max-w-7xl mx-auto px-6 py-12 space-y-8">
        <div className="text-center space-y-2">
          <h2 className="text-2xl md:text-3xl font-bold text-white">Katalog Kamar & Suite</h2>
          <p className="text-xs text-slate-400">Data kamar ditarik langsung dari SaCMS Content API</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {rooms.map((room: any, i: number) => (
            <div key={i} className="p-6 rounded-2xl border border-slate-800 bg-slate-900/60 space-y-4 hover:border-amber-500/40 transition-all flex flex-col justify-between">
              <div className="space-y-3">
                <div className="h-44 rounded-xl bg-slate-800/80 border border-slate-700 flex items-center justify-center text-slate-400 text-xs font-medium">
                  [Foto Kamar: {room.data?.title || room.title}]
                </div>
                <div className="space-y-1">
                  <h3 className="font-bold text-lg text-white">{room.data?.title || room.title}</h3>
                  <p className="text-amber-400 font-extrabold text-base">
                    Rp {Number(room.data?.price || room.price || 0).toLocaleString("id-ID")} <span className="text-xs font-normal text-slate-400">/ malam</span>
                  </p>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {room.data?.features || room.features || "Fasilitas lengkap dengan sarapan pagi dan koneksi WiFi kecepatan tinggi."}
                </p>
              </div>
              <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
                <span className="text-xs text-slate-400 flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5 text-amber-400" /> {room.data?.capacity || room.capacity || "2 Tamu"}
                </span>
                <button className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-xs font-bold text-white transition-colors">
                  Pilih Kamar
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}`,
      })
    } else if (isStore) {
      files.push({
        path: "app/page.tsx",
        content: `import { getCollection } from "@/lib/sacms";
import { ShoppingBag, Sparkles, Star, Tag } from "lucide-react";

export default async function StoreHomePage() {
  const products = await getCollection("products");

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 font-sans">
      <header className="border-b border-slate-800 px-6 py-4 flex items-center justify-between max-w-7xl mx-auto">
        <div className="flex items-center gap-2">
          <ShoppingBag className="h-5 w-5 text-indigo-400" />
          <span className="font-bold text-base text-white">Papua Craft & Noken Store</span>
        </div>
        <button className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-xs">
          Keranjang (0)
        </button>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-12 space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl md:text-5xl font-extrabold text-white">Koleksi Asli Kerajinan Papua</h1>
          <p className="text-xs text-slate-400">Produk original langsung dari perajin lokal Nabire</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {products.map((p: any, i: number) => (
            <div key={i} className="p-5 rounded-2xl border border-slate-800 bg-slate-900/60 space-y-3">
              <div className="h-40 rounded-xl bg-slate-800 flex items-center justify-center text-slate-500 text-xs">
                [Foto Produk: {p.data?.name || p.name}]
              </div>
              <h3 className="font-bold text-base text-white">{p.data?.name || p.name}</h3>
              <p className="text-indigo-400 font-extrabold text-sm">
                Rp {Number(p.data?.price || p.price || 0).toLocaleString("id-ID")}
              </p>
              <button className="w-full py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white transition-colors">
                Beli Sekarang
              </button>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}`,
      })
    } else {
      files.push({
        path: "app/page.tsx",
        content: `import { getCollection } from "@/lib/sacms";
import { Sparkles, ArrowRight, Layers, Globe, Zap } from "lucide-react";

export default async function GeneralHomePage() {
  const articles = await getCollection("articles");

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 p-6 flex flex-col items-center justify-center max-w-4xl mx-auto space-y-8">
      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-xs font-semibold text-indigo-400">
        <Sparkles className="h-3.5 w-3.5" />
        Website Dynamic Powered by SaCMS MCP
      </div>

      <h1 className="text-4xl md:text-6xl font-extrabold text-white text-center tracking-tight">
        Portal Informasi & Layanan Terintegrasi
      </h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full pt-4">
        {articles.map((art: any, i: number) => (
          <div key={i} className="p-5 rounded-2xl border border-slate-800 bg-slate-900/60 space-y-2">
            <h3 className="font-bold text-base text-white">{art.data?.title || art.title}</h3>
            <p className="text-xs text-slate-400">{art.data?.excerpt || art.excerpt || "Ringkasan artikel dinamis."}</p>
          </div>
        ))}
      </div>
    </main>
  );
}`,
      })
    }

    return files
  }
}
