import { generateText } from "ai"
import { McpClientBridge } from "./mcp/mcp-client-bridge"
import type { GeneratedSystemSchema } from "./ai-schema-generator"

// STEP 1 of the 3-step pipeline (UI -> Schema -> API connect). This prompt
// deliberately asks for a fully self-contained SPA with AI-INVENTED MOCK
// DATA ONLY — no CMS schema, no fetch(), no live data context. That's what
// keeps this call small, fast, and reliable: the old single-shot flow had
// to fit a full SPA (HTML+JS) AND the REST API wiring AND a live schema
// dump in its prompt context within one shared token budget, which is what
// caused truncated/incomplete output. Schema generation (step 2) and real
// API wiring (step 3) are separate, narrower, user-triggered calls with
// their own budgets — see generateSchemaFromMockUi/connectStaticSiteToApi.
const UI_SYSTEM_PROMPT = `You are a world-class frontend engineer and UI designer specializing in building modern, production-grade Single Page Applications (SPA) with Vue.js 3 and Tailwind CSS.

Architecture & Output Constraints:
- Output MUST be split into exactly TWO files: \`index.html\` and \`app.js\`. Do not create or reference any other files.
- This is a VISUAL DESIGN pass only — there is NO backend yet. ALL data must be realistic, richly detailed, hardcoded MOCK data you invent yourself directly in \`app.js\`. Do NOT write any \`fetch()\` calls, do NOT reference any API, do NOT leave any TODO/placeholder — the mock data IS the content shown to the user, make it as complete and polished as live data would be.
- You MUST format your entire response using these exact delimiters:

<<<INDEX_HTML>>>
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Website Title</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://cdn.jsdelivr.net/npm/vue@3/dist/vue.global.prod.js"></script>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    body { font-family: 'Plus Jakarta Sans', sans-serif; }
    [v-cloak] { display: none; }
  </style>
</head>
<body class="bg-slate-50 text-slate-900 antialiased min-h-screen flex flex-col">
  <div id="app" v-cloak class="flex-1 flex flex-col">
    <!-- Navbar / Header with reactive view switcher e.g. @click="currentView = 'home'" -->
    <!-- Hero / Featured Section -->
    <!-- Content listings with filters and search -->
    <!-- Detail view or modal with interactive back / close -->
    <!-- Contact / Order / Inquiry modal or form -->
    <!-- Footer with branding and links -->
  </div>
  <script src="app.js"></script>
</body>
</html>
<<<END_INDEX_HTML>>>

<<<APP_JS>>>
const { createApp, ref, reactive, computed, onMounted } = Vue;

const app = createApp({
  setup() {
    const currentView = ref('home');
    const loading = ref(false);
    const searchQuery = ref('');
    const selectedItem = ref(null);
    const isMobileMenuOpen = ref(false);

    // MOCK:rooms
    const rooms = ref([
      { id: 1, title: "Deluxe Ocean Suite", price: 1250000, image: "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=800&q=80" },
      { id: 2, title: "Executive Family Villa", price: 2450000, image: "https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=800&q=80" }
    ]);
    // /MOCK:rooms

    // MOCK:profil_usaha
    const profilUsaha = ref({
      nama: "Nama Bisnis",
      tagline: "Tagline singkat yang menjual",
      deskripsi: "Deskripsi lengkap dan menarik tentang bisnis ini."
    });
    // /MOCK:profil_usaha

    return {
      currentView,
      loading,
      searchQuery,
      selectedItem,
      isMobileMenuOpen,
      rooms,
      profilUsaha,
      // expose all states and methods
    };
  }
});

app.mount('#app');
<<<END_APP_JS>>>

CRITICAL CODING RULES TO PREVENT CRASHES & TIMEOUTS:
1. TOKEN SAVINGS & NO SVG SPAM:
   - NEVER generate repetitive, multi-hundred character SVG path coordinates.
   - Use clean, standard simple SVGs (max 1-2 path elements, e.g. standard Lucide/Heroicon stroke paths) or standard Unicode Emojis (e.g. 🏢, 👥, 📈, 📞, 🛍️, 📰).
   - Never loop coordinate numbers!

2. MOCK DATA MARKERS — MANDATORY:
   - Every distinct data entity in \`app.js\` (an array of listing items, OR a single settings/profile object) MUST be wrapped in comment markers immediately around its \`ref()\`/\`reactive()\` declaration:
     \`\`\`javascript
     // MOCK:<entity_slug>
     const <varName> = ref(/* array or object */);
     // /MOCK:<entity_slug>
     \`\`\`
   - \`<entity_slug>\` is a short lowercase kebab/snake-case name describing the entity (e.g. \`rooms\`, \`produk\`, \`profil_toko\`, \`testimoni\`). It MUST be unique per entity and MUST exactly match the opening and closing marker.
   - Use an ARRAY sample (multiple items) for things that are naturally a list/collection (products, rooms, articles, testimonials). Use a single OBJECT sample for a one-off settings/profile/config entity. This distinction matters — it decides what kind of CMS collection this becomes later.
   - Give every array item a realistic, complete shape (3-5 fields) and 2-4 sample items. Give every object sample ALL the fields a reader would expect, fully filled in — no \`null\`/\`undefined\`/empty-string placeholders.
   - UI-only local state (currentView, loading, searchQuery, isMobileMenuOpen, selectedItem, etc.) must NOT be wrapped in MOCK markers — only real content data.

3. DEFENSIVE VUE 3 REACTIVE STATE:
   - NEVER leave a referenced nested object as \`null\` or \`undefined\`, otherwise templates accessing nested fields will throw a runtime TypeError and crash Vue rendering!

4. SAFE TEMPLATE EXPRESSIONS & HELPERS:
   - In \`index.html\`, always use safe optional chaining and provide fallbacks:
     \`{{ (profilUsaha?.statistik?.total || 0).toLocaleString('id-ID') }}\`
   - Or provide helper formatting methods in \`setup()\`:
     \`const formatNumber = (val) => Number(val || 0).toLocaleString('id-ID');\`
     \`const formatRupiah = (val) => 'Rp ' + Number(val || 0).toLocaleString('id-ID');\`

5. Output ONLY the two delimited blocks (<<<INDEX_HTML>>>...<<<END_INDEX_HTML>>> and <<<APP_JS>>>...<<<END_APP_JS>>>). Do not wrap the entire response in markdown or add commentary.`

export interface StaticSiteResult {
  html: string
  js: string
}

export function extractFiles(rawText: string): { html: string; js: string } {
  let html = ""
  let js = ""

  // 1. Delimiter tag match
  const htmlMatch = rawText.match(/<<<INDEX_HTML>>>([\s\S]*?)<<<END_INDEX_HTML>>>/i)
  if (htmlMatch) {
    html = htmlMatch[1].trim()
  }

  const jsMatch = rawText.match(/<<<APP_JS>>>([\s\S]*?)<<<END_APP_JS>>>/i)
  if (jsMatch) {
    js = jsMatch[1].trim()
  }

  // 2. Fallback if tag closed prematurely or missing end tag
  if (!html && rawText.includes("<<<INDEX_HTML>>>")) {
    const afterHtml = rawText.split("<<<INDEX_HTML>>>")[1] || ""
    if (afterHtml.includes("<<<APP_JS>>>")) {
      html = afterHtml.split("<<<APP_JS>>>")[0].replace("<<<END_INDEX_HTML>>>", "").trim()
    } else {
      html = afterHtml.replace("<<<END_INDEX_HTML>>>", "").trim()
    }
  }

  if (!js && rawText.includes("<<<APP_JS>>>")) {
    const afterJs = rawText.split("<<<APP_JS>>>")[1] || ""
    js = afterJs.replace("<<<END_APP_JS>>>", "").trim()
  }

  // 3. Fallback to markdown code blocks
  if (!html) {
    const mdHtmlMatch = rawText.match(/```(?:html|xml)\s*([\s\S]*?)```/i)
    if (mdHtmlMatch) {
      html = mdHtmlMatch[1].trim()
    } else if (rawText.includes("<!DOCTYPE html>") || rawText.includes("<html")) {
      const startIdx = rawText.indexOf("<!DOCTYPE html>") !== -1 ? rawText.indexOf("<!DOCTYPE html>") : rawText.indexOf("<html")
      const endIdx = rawText.lastIndexOf("</html>")
      if (endIdx > startIdx) {
        html = rawText.slice(startIdx, endIdx + 7).trim()
      }
    }
  }

  if (!js) {
    const mdJsMatch = rawText.match(/```(?:javascript|js|vue)\s*([\s\S]*?)```/i)
    if (mdJsMatch) {
      js = mdJsMatch[1].trim()
    } else if (rawText.includes("createApp(") || rawText.includes("Vue.createApp")) {
      const startIdx = Math.min(
        ...[rawText.indexOf("const { createApp"), rawText.indexOf("const app = createApp"), rawText.indexOf("Vue.createApp")].filter(i => i >= 0)
      )
      if (startIdx >= 0) {
        const afterStart = rawText.slice(startIdx)
        const mountIdx = afterStart.indexOf(".mount('#app')")
        if (mountIdx !== -1) {
          const semiIdx = afterStart.indexOf(";", mountIdx)
          js = afterStart.slice(0, (semiIdx !== -1 ? semiIdx + 1 : mountIdx + 15)).trim()
        } else {
          js = afterStart.trim()
        }
      }
    }
  }

  // Clean any residual markdown fences in extracted js/html
  if (js.startsWith("```")) {
    js = js.replace(/^```(?:javascript|js)?\s*/i, "").replace(/```\s*$/, "").trim()
  }
  if (html.startsWith("```")) {
    html = html.replace(/^```(?:html)?\s*/i, "").replace(/```\s*$/, "").trim()
  }

  // If even the lenient heuristics above couldn't find anything, don't
  // silently substitute an unrelated hardcoded template — that used to
  // happen here and masked real generation failures as fake successes.
  // Surface it so the caller can show a clear, actionable error instead.
  if (!html || !js) {
    throw new Error("AI tidak mengembalikan format index.html/app.js yang valid. Coba generate ulang, atau pilih model lain.")
  }

  return { html, js }
}

/**
 * Parses `// MOCK:<slug> ... // /MOCK:<slug>` comment-delimited blocks out
 * of a Step-1-generated app.js (see UI_SYSTEM_PROMPT). Deterministic, no AI
 * involved — used by Step 2 (derive a CMS schema matching these entities)
 * and Step 3 (rewire these same refs to fetch real data). Entities without
 * a matching closing marker are skipped rather than breaking the parse.
 */
export function extractMockEntities(js: string): { slug: string; varName: string; kind: "content" | "single"; sampleJson: string }[] {
  const entities: { slug: string; varName: string; kind: "content" | "single"; sampleJson: string }[] = []
  const markerRegex = /\/\/\s*MOCK:([\w-]+)([\s\S]*?)\/\/\s*\/MOCK:\1/g

  let match: RegExpExecArray | null
  while ((match = markerRegex.exec(js)) !== null) {
    const slug = match[1]
    const body = match[2]
    const varMatch = body.match(/(?:const|let)\s+(\w+)\s*=\s*(?:ref|reactive)\(/)
    if (!varMatch) continue

    const trimmedAfterVar = body.slice(varMatch.index! + varMatch[0].length).trimStart()
    const sampleJson = trimmedAfterVar.replace(/\);\s*$/, "").trim()
    const kind: "content" | "single" = sampleJson.startsWith("[") ? "content" : "single"

    entities.push({ slug, varName: varMatch[1], kind, sampleJson })
  }

  return entities
}

/**
 * Ensures Single Types and Content Types in the CMS have realistic published data
 * so public REST API endpoints return 200 OK with live data immediately.
 */
export async function seedMissingCmsDataViaMcp(bridge: McpClientBridge) {
  const schema = await bridge.getFullSchema()
  let seededCount = 0

  // 1. Single Types
  for (const st of schema.singleTypes) {
    if (!st.hasData) {
      const dummyData: Record<string, any> = {}
      for (const field of st.fields) {
        if (field.slug === "nama_desa") dummyData[field.slug] = "Desa Intan Mandiri"
        else if (field.slug === "slogan") dummyData[field.slug] = "Desa Maju, Berdaya & Sejahtera"
        else if (field.slug === "sambutan_kades") dummyData[field.slug] = "Selamat datang di website resmi Desa Intan Mandiri. Portal ini wujud komitmen kami dalam keterbukaan informasi dan pelayanan prima."
        else if (field.slug === "foto_kades") dummyData[field.slug] = "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=400"
        else if (field.slug === "visi") dummyData[field.slug] = "Mewujudkan Desa Mandiri, Sejahtera, dan Berkelanjutan Berbasis Kearifan Lokal."
        else if (field.slug === "misi") dummyData[field.slug] = "1. Meningkatkan kualitas tata kelola pemerintahan desa.\n2. Mengoptimalkan potensi ekonomi desa dan UMKM lokal.\n3. Menyediakan layanan administrasi cepat dan transparan."
        else if (field.slug === "kontak_email") dummyData[field.slug] = "layanan@desaintan.desa.id"
        else if (field.slug === "telepon") dummyData[field.slug] = "0812-3456-7890"
        else if (field.slug === "alamat_kantor") dummyData[field.slug] = "Jl. Poros Balai Desa No. 01, Intan Jaya"
        else if (field.slug === "peta_lokasi") dummyData[field.slug] = "https://maps.google.com"
        else if (field.slug === "statistik_penduduk_data") {
          dummyData[field.slug] = {
            total_penduduk: 3840,
            jumlah_kk: 1120,
            laki_laki: 1920,
            perempuan: 1920,
            luas_wilayah: "14.5 km²",
            dusun_count: 4,
          }
        } else if (field.slug === "tahun_anggaran") dummyData[field.slug] = 2026
        else if (field.slug === "pendapatan_desa") dummyData[field.slug] = 1850000000
        else if (field.slug === "belanja_desa") dummyData[field.slug] = 1780000000
        else if (field.slug === "pembiayaan_desa") dummyData[field.slug] = 70000000
        else if (field.slug === "link_laporan_pdf") dummyData[field.slug] = "https://example.com/apbdes-2026.pdf"
        else if (field.type === "number") dummyData[field.slug] = 100
        else if (field.type === "boolean") dummyData[field.slug] = true
        else dummyData[field.slug] = `Informasi ${field.name}`
      }
      await bridge.updateSingleTypeContent({ singleTypeSlug: st.slug, data: dummyData })
      seededCount++
    }
  }

  // 2. Content Types
  for (const ct of schema.contentTypes) {
    const existing = await bridge.queryContent({ contentTypeSlug: ct.slug, limit: 1 })
    if (!existing.data || existing.data.length === 0) {
      if (ct.slug === "berita-pengumuman") {
        await bridge.createContentEntry({
          contentTypeSlug: ct.slug,
          data: {
            judul: "Penyaluran BLT Dana Desa Tahap I Berjalan Tertib",
            slug: "penyaluran-blt-tahap-1",
            kategori: "Pemerintahan",
            ringkasan: "Pemerintah Desa telah menyalurkan bantuan langsung tunai kepada 120 KPM penerima manfaat.",
            isi_konten: "Penyaluran bertempat di Balai Desa dihadiri oleh perwakilan BPD, Babinsa, dan tokoh masyarakat desa.",
            gambar_sampul: "https://images.unsplash.com/photo-1577495508048-b635879837f1?w=800",
            tanggal_publikasi: new Date().toISOString(),
            status: "PUBLISHED",
          },
          status: "PUBLISHED",
        })
        await bridge.createContentEntry({
          contentTypeSlug: ct.slug,
          data: {
            judul: "Pelatihan Kewirausahaan Digital untuk Pelaku UMKM Desa",
            slug: "pelatihan-umkm-desa",
            kategori: "Pemberdayaan",
            ringkasan: "Sebanyak 40 pelaku UMKM lokal mengikuti bimbingan teknis pemasaran online dan pembukuan sederhana.",
            isi_konten: "Pelatihan ini bertujuan mendorong produk olahan pangan dan kerajinan desa merambah marketplace online.",
            gambar_sampul: "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=800",
            tanggal_publikasi: new Date().toISOString(),
            status: "PUBLISHED",
          },
          status: "PUBLISHED",
        })
        seededCount += 2
      } else if (ct.slug === "aparatur-desa") {
        await bridge.createContentEntry({
          contentTypeSlug: ct.slug,
          data: {
            nama_lengkap: "Drs. H. Mulyono Santoso",
            jabatan: "Kepala Desa",
            nip: "197805122005011002",
            foto: "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=400",
            urutan_tampil: 1,
          },
          status: "PUBLISHED",
        })
        await bridge.createContentEntry({
          contentTypeSlug: ct.slug,
          data: {
            nama_lengkap: "Siti Rahmawati, S.AP",
            jabatan: "Sekretaris Desa",
            nip: "198402182010012005",
            foto: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400",
            urutan_tampil: 2,
          },
          status: "PUBLISHED",
        })
        seededCount += 2
      } else if (ct.slug === "potensi-umkm") {
        await bridge.createContentEntry({
          contentTypeSlug: ct.slug,
          data: {
            nama_usaha: "Kopi Robusta Lereng Intan",
            pemilik: "Pak Sugeng",
            kontak_wa: "6281234567890",
            deskripsi: "Biji kopi petik merah premium khas perkebunan lereng desa dengan aroma karamel alami.",
            harga_mulai: 35000,
            foto_produk: "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=600",
            kategori_produk: "Minuman",
            lokasi_umkm: "Dusun Krajan RT 02",
          },
          status: "PUBLISHED",
        })
        await bridge.createContentEntry({
          contentTypeSlug: ct.slug,
          data: {
            nama_usaha: "Keripik Singkong Renyah Bu Ani",
            pemilik: "Ibu Ani",
            kontak_wa: "6281234567891",
            deskripsi: "Camilan renyah tanpa bahan pengawet dengan aneka varian rasa balado, keju, dan original.",
            harga_mulai: 15000,
            foto_produk: "https://images.unsplash.com/photo-1566478989037-eec170784d0b?w=600",
            kategori_produk: "Makanan Ringan",
            lokasi_umkm: "Dusun Sinar Jaya RT 01",
          },
          status: "PUBLISHED",
        })
        seededCount += 2
      } else {
        const item1: Record<string, any> = {}
        const item2: Record<string, any> = {}
        for (const field of ct.fields) {
          if (field.type === "currency" || field.slug.includes("harga") || field.slug.includes("price") || field.slug.includes("biaya")) {
            item1[field.slug] = 45000
            item2[field.slug] = 85000
          } else if (field.type === "number") {
            item1[field.slug] = 10
            item2[field.slug] = 25
          } else if (field.type === "rating") {
            item1[field.slug] = 5
            item2[field.slug] = 4
          } else if (field.type === "boolean") {
            item1[field.slug] = true
            item2[field.slug] = false
          } else if (field.type === "media" || field.slug.includes("foto") || field.slug.includes("gambar") || field.slug.includes("cover")) {
            item1[field.slug] = "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800"
            item2[field.slug] = "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800"
          } else if (field.slug === "slug") {
            item1[field.slug] = `${ct.slug}-1`
            item2[field.slug] = `${ct.slug}-2`
          } else if (field.slug.includes("nama") || field.slug.includes("title") || field.slug.includes("judul")) {
            item1[field.slug] = `Pilihan Terbaik ${ct.name} A`
            item2[field.slug] = `Pilihan Populer ${ct.name} B`
          } else if (field.type === "richText" || field.type === "markdown" || field.slug.includes("deskripsi") || field.slug.includes("content")) {
            item1[field.slug] = `<p>Deskripsi lengkap dan keunggulan untuk ${ct.name} dengan standar kualitas tinggi.</p>`
            item2[field.slug] = `<p>Pilihan andalan yang paling diminati oleh pelanggan dengan layanan prima.</p>`
          } else {
            item1[field.slug] = `Item ${ct.name} 1`
            item2[field.slug] = `Item ${ct.name} 2`
          }
        }
        await bridge.createContentEntry({
          contentTypeSlug: ct.slug,
          data: item1,
          status: "PUBLISHED",
        })
        await bridge.createContentEntry({
          contentTypeSlug: ct.slug,
          data: item2,
          status: "PUBLISHED",
        })
        seededCount += 2
      }
    }
  }

  return seededCount
}

// Kept only as an offline fallback for shouldProvisionSchema below, for
// when the classifier call itself fails (Gateway down/misconfigured) — not
// the primary detection mechanism anymore, since a fixed list can never
// cover every business domain a user might type.
const FALLBACK_DOMAIN_KEYWORDS = [
  "rental", "mobil", "motor", "sewa", "kendaraan",
  "klinik", "dokter", "medis", "rumah sakit", "dental", "gigi", "apotek",
  "toko", "shop", "ecommerce", "e-commerce", "baju", "produk", "distro", "fashion", "katalog",
  "hotel", "resort", "villa", "kamar", "penginapan", "homestay",
  "cafe", "kopi", "coffee", "resto", "restoran", "kuliner", "makanan", "f&b",
  "sekolah", "kursus", "edukasi", "akademi", "les", "universitas", "kampus",
  "properti", "real estate", "apartemen", "perumahan", "kost",
  "salon", "barbershop", "spa", "skincare", "kecantikan",
  "gym", "fitness", "olahraga",
  "laundry", "cuci",
]

/**
 * Decides whether the workspace needs new CMS schema generated for this
 * prompt. An empty workspace always needs it (free, no AI call). Otherwise
 * a small classification call asks the model directly whether the existing
 * schema can satisfy the prompt — this replaces a fixed keyword list, which
 * could only ever recognize a handful of hardcoded business types and would
 * silently do nothing for anything else (e.g. "pesantren", "koperasi").
 *
 * Treated as internal/unbilled overhead (no enforceAiQuota/recordAiUsage):
 * it's a small, bounded routing decision, not a user-initiated generation —
 * the actual generation calls downstream are what get metered.
 */
async function shouldProvisionSchema(
  schema: { contentTypes: { slug: string; name: string }[]; singleTypes: { slug: string; name: string }[] },
  prompt: string,
  overrideModel?: string,
): Promise<boolean> {
  const hasNoSchemas = schema.contentTypes.length === 0 && schema.singleTypes.length === 0
  if (hasNoSchemas) return true

  const fallbackHeuristic = () => {
    const p = prompt.toLowerCase()
    const promptMentionsDomain = FALLBACK_DOMAIN_KEYWORDS.some((kw) => p.includes(kw))
    const schemaMatchesDomain = schema.contentTypes.some((ct) =>
      FALLBACK_DOMAIN_KEYWORDS.some((kw) => ct.slug.includes(kw) || ct.name.toLowerCase().includes(kw))
    )
    return promptMentionsDomain && !schemaMatchesDomain
  }

  try {
    const { resolveGatewayModel } = await import("./ai")
    const { generateObject } = await import("ai")
    const { z } = await import("zod")
    const { model } = await resolveGatewayModel(overrideModel)

    const schemaSummary = [
      ...schema.contentTypes.map((ct) => `- Content Type: ${ct.name} (${ct.slug})`),
      ...schema.singleTypes.map((st) => `- Single Type: ${st.name} (${st.slug})`),
    ].join("\n") || "(belum ada skema)"

    const { object } = await generateObject({
      model,
      schema: z.object({
        schemaIsRelevant: z.boolean().describe(
          "true jika skema yang sudah ada cukup relevan untuk memenuhi permintaan user, false jika perlu Content Type/Single Type baru dibuat"
        ),
      }),
      system: "Anda classifier internal SaCMS. Nilai singkat dan tegas apakah skema CMS yang ada relevan dengan permintaan website user.",
      prompt: `Skema CMS yang sudah ada:\n${schemaSummary}\n\nPermintaan user: "${prompt}"`,
      maxOutputTokens: 50,
    })

    return !object.schemaIsRelevant
  } catch (err) {
    console.warn("[AI Website Builder] Schema relevance classifier failed, falling back to keyword match:", err)
    return fallbackHeuristic()
  }
}

/**
 * Memastikan workspace memiliki skema database yang relevan via MCP.
 * Jika belum ada skema atau prompt meminta domain bisnis baru yang belum tersedia,
 * sistem secara mandiri membangun skema database SaCMS dan melakukan seeding data terbit (PUBLISHED).
 */
export async function ensureWorkspaceSchemaAndDataViaMcp(
  bridge: McpClientBridge,
  prompt: string,
  tenantId: string,
  userId?: string,
  overrideModel?: string,
  opts?: { skipQuotaCheck?: boolean; knownShouldProvision?: boolean },
) {
  let schema = await bridge.getFullSchema()

  const shouldProvision = opts?.knownShouldProvision ?? (await shouldProvisionSchema(schema, prompt, overrideModel))

  if (shouldProvision) {
    try {
      console.log(`[AI Website Builder] Auto-provisioning schema via MCP based on prompt: "${prompt}"...`)
      const { generateSystemSchema } = await import("./ai-schema-generator")
      const generated = await generateSystemSchema(prompt, tenantId, userId, overrideModel, opts?.skipQuotaCheck)
      const res = await bridge.applyGeneratedSchema(generated)
      console.log(`[AI Website Builder] Schema applied via MCP successfully:`, res)
      schema = await bridge.getFullSchema()
    } catch (genErr) {
      console.warn("[AI Website Builder] Warning auto-generating schema via MCP:", genErr)
    }
  }

  // Lakukan seeding data untuk skema yang ada jika ada yang belum memiliki entri terbit
  await seedMissingCmsDataViaMcp(bridge)
  return await bridge.getFullSchema()
}

/**
 * STEP 1: Generate the visual design only — a self-contained Vue 3 SPA with
 * AI-invented mock data, no CMS schema/MCP bridge touched at all. This is
 * what every entry point (both dashboard generate buttons, and the MCP tool)
 * calls first. Schema generation and real API wiring are separate opt-in
 * steps the user triggers afterward — see generateSchemaFromMockUi and
 * connectStaticSiteToApi below.
 */
export async function generateStaticSite(
  prompt: string,
  tenantId: string,
  tenantSlug: string,
  userId?: string,
  overrideModel?: string,
): Promise<StaticSiteResult> {
  const { resolveGatewayModel, enforceAiQuota, recordAiUsage, toUsageTotals, withAiRetry } = await import("./ai")

  const config = { tenantId, userId, creditsCost: 5, action: "generate_static_site_ui" }
  await enforceAiQuota(config)

  const userPrompt = `User's Goal & Design Instruction:
${prompt}

Output ONLY the two delimited blocks <<<INDEX_HTML>>>...<<<END_INDEX_HTML>>> and <<<APP_JS>>>...<<<END_APP_JS>>>, with every data entity wrapped in // MOCK:<slug> markers as instructed.`

  const { model, modelId } = await resolveGatewayModel(overrideModel)

  const result = await withAiRetry(() =>
    generateText({
      model,
      system: UI_SYSTEM_PROMPT,
      prompt: userPrompt,
      maxOutputTokens: 14000,
    })
  )

  if (result.finishReason === "length") {
    throw new Error("Output AI terpotong karena melebihi batas panjang. Coba prompt yang lebih sederhana, atau pilih model lain.")
  }

  const files = extractFiles(result.text)

  await recordAiUsage(config, toUsageTotals(result.usage), modelId, files.html + files.js)

  return files
}

/**
 * STEP 2 (opsional, dipicu manual lewat tombol "Buatkan Skema Sesuai
 * Tampilan Ini"): menurunkan skema CMS dari entitas mock yang sudah ada di
 * app.js hasil Step 1 — bukan dari free-form business prompt seperti
 * `generateSystemSchema` biasanya dipakai. Prompt turunan di bawah secara
 * eksplisit memaksa slug & field PERSIS SAMA dengan sample mock-nya, supaya
 * Step 3 nanti bisa mencocokkan entity<->schema lewat slug tanpa fuzzy
 * matching, dan memaksa dummyData dari schema generation memakai nilai
 * sample yang sebenarnya (bukan rekaan baru) — supaya `applyGeneratedSchema`
 * yang sudah ada otomatis men-seed data yang konsisten dengan tampilan.
 */
export async function generateSchemaFromMockUi(
  entities: { slug: string; varName: string; kind: "content" | "single"; sampleJson: string }[],
  prompt: string,
  tenantId?: string,
  userId?: string,
  overrideModel?: string,
): Promise<GeneratedSystemSchema> {
  const { generateSystemSchema } = await import("./ai-schema-generator")

  const derivedPrompt = `Website ini SUDAH memiliki tampilan (UI) yang dirancang dengan data contoh (mock) berikut. Buatkan skema CMS yang mencerminkan struktur ini SECARA PERSIS.

ATURAN KETAT — WAJIB DIPATUHI:
1. Setiap entitas di bawah menjadi SATU Content Type (jika "kind" adalah "content", yaitu daftar/koleksi) atau SATU Single Type (jika "kind" adalah "single", yaitu objek tunggal).
2. Slug Content Type/Single Type HARUS PERSIS SAMA dengan "slug" yang diberikan di bawah — JANGAN mengubah atau menerjemahkan nama slug.
3. Field-field HARUS PERSIS mencerminkan key yang ada di sample JSON — JANGAN menambah field, JANGAN menghapus field, JANGAN mengganti nama field.
4. JANGAN membuat Content Type/Single Type/Component TAMBAHAN di luar entitas yang disebutkan di bawah, walau secara normal Anda akan menyarankannya untuk bisnis semacam ini.
5. Isi "dummyData" PERSIS dengan nilai dari sample JSON di bawah (untuk Content Type, buat satu dummyData entry per item array; untuk Single Type, satu dummyData object).

Konteks tujuan website (hanya untuk membantu memilih tipe field yang tepat, BUKAN untuk menambah entitas baru): "${prompt}"

Entitas yang harus dibuatkan skemanya:
${entities.map((e) => `### ${e.slug} (${e.kind === "content" ? "Content Type — koleksi" : "Single Type — objek tunggal"})\n${e.sampleJson}`).join("\n\n")}`

  return generateSystemSchema(derivedPrompt, tenantId, userId, overrideModel)
}

// STEP 3 of the pipeline — rewires an already-mock app.js to fetch real
// data from the Public REST API instead of using its hardcoded // MOCK:
// blocks, without touching index.html at all. Scoped narrowly (JS only, no
// schema dump needed as input context) so it reliably fits a much smaller
// token budget than the old single-shot flow ever could.
const API_CONNECT_SYSTEM_PROMPT = `You are refactoring an existing Vue 3 app.js file to fetch real data from a REST API instead of using its hardcoded mock values.

Rules:
- You will be given the CURRENT app.js, and a manifest of which ref variables should be wired to which API endpoint.
- For each manifest entry, keep its current mock value as the ref's initial/fallback state (do NOT delete it), then add fetch logic inside (or alongside) the existing onMounted() that overwrites it on success:
  - Single Type endpoints return \`{ data: {...fields} }\` — on success do \`theRef.value = { ...theRef.value, ...json.data }\`.
  - Content Type endpoints return \`{ data: [...entries] }\` — on success do \`if (json.data && json.data.length > 0) theRef.value = json.data\`.
- Wrap every fetch in try/catch — on failure or non-ok response, silently keep the existing mock value (never throw, never clear the ref).
- Do NOT touch any other part of the file (UI-only state, methods, computed, unrelated refs) beyond adding this fetch wiring.
- Do NOT remove the // MOCK:<slug> ... // /MOCK:<slug> comment markers — leave them exactly where they are, around the same ref declarations.
- Output ONLY the full, complete, updated app.js wrapped in <<<APP_JS>>>...<<<END_APP_JS>>>. No markdown fences, no commentary.`

export async function connectStaticSiteToApi(
  js: string,
  manifest: { varName: string; endpoint: string; kind: "content" | "single" }[],
  tenantId: string,
  userId?: string,
  overrideModel?: string,
): Promise<{ js: string }> {
  const { resolveGatewayModel, enforceAiQuota, recordAiUsage, toUsageTotals, withAiRetry } = await import("./ai")

  const config = { tenantId, userId, creditsCost: 3, action: "connect_static_site_api" }
  await enforceAiQuota(config)

  const userPrompt = `Current app.js:
\`\`\`javascript
${js}
\`\`\`

Manifest (wire these refs to fetch real data):
${JSON.stringify(manifest, null, 2)}`

  const { model, modelId } = await resolveGatewayModel(overrideModel)

  const result = await withAiRetry(() =>
    generateText({
      model,
      system: API_CONNECT_SYSTEM_PROMPT,
      prompt: userPrompt,
      maxOutputTokens: 8000,
    })
  )

  if (result.finishReason === "length") {
    throw new Error("Output AI terpotong karena melebihi batas panjang. Coba lagi, atau pilih model lain.")
  }

  const jsMatch = result.text.match(/<<<APP_JS>>>([\s\S]*?)<<<END_APP_JS>>>/i)
  const newJs = jsMatch ? jsMatch[1].trim() : result.text.trim()

  if (!newJs) {
    throw new Error("AI tidak mengembalikan app.js yang valid. Coba lagi.")
  }

  await recordAiUsage(config, toUsageTotals(result.usage), modelId, newJs)

  return { js: newJs }
}
