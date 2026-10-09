import { generateText } from "ai"
import { McpClientBridge } from "./mcp/mcp-client-bridge"

const SYSTEM_PROMPT = `You are a world-class frontend engineer and UI designer specializing in building modern, production-grade Single Page Applications (SPA) with Vue.js 3 and Tailwind CSS, powered by a headless CMS Public REST API.

Architecture & Output Constraints:
- Output MUST be split into exactly TWO files: \`index.html\` and \`app.js\`. Do not create or reference any other files.
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
    const loading = ref(true);
    const searchQuery = ref('');
    const selectedItem = ref(null);
    const isMobileMenuOpen = ref(false);

    // Initial state matching the CMS schema with rich realistic fallbacks:
    // ...
    // REST API fetchers:
    // ...
    return {
      currentView,
      loading,
      searchQuery,
      selectedItem,
      isMobileMenuOpen,
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

2. DEFENSIVE VUE 3 REACTIVE STATE:
   - In \`app.js\` \`setup()\`, ALWAYS initialize EVERY variable used in templates with a COMPLETE, REALISTIC default object matching the schema fields!
   - Example for single types (e.g., \`profilDesa\`):
     \`\`\`javascript
     const profilDesa = ref({
       nama_desa: "Desa Intan Mandiri",
       slogan: "Maju, Berdaya & Sejahtera",
       sambutan_kades: "Selamat datang di website resmi kami...",
       statistik_penduduk_data: {
         total_penduduk: 3840,
         jumlah_kk: 1120,
         laki_laki: 1920,
         perempuan: 1920,
       },
     });
     \`\`\`
   - NEVER leave a referenced nested object as \`null\` or \`undefined\`, otherwise templates accessing nested fields like \`profilDesa.statistik_penduduk_data.total_penduduk\` will throw a runtime TypeError and crash Vue rendering!

3. SAFE TEMPLATE EXPRESSIONS & HELPERS:
   - In \`index.html\`, always use safe optional chaining and provide fallbacks:
     \`{{ (profilDesa?.statistik_penduduk_data?.total_penduduk || 0).toLocaleString('id-ID') }}\`
   - Or provide helper formatting methods in \`setup()\`:
     \`const formatNumber = (val) => Number(val || 0).toLocaleString('id-ID');\`
     \`const formatRupiah = (val) => 'Rp ' + Number(val || 0).toLocaleString('id-ID');\`
     and use \`{{ formatNumber(profilDesa?.statistik_penduduk_data?.total_penduduk) }}\` in HTML.

4. SaCMS PUBLIC REST API CONVENTIONS:
   - Single Type: \`GET {apiBase}/single/{singleTypeSlug}\` -> response: \`{ data: { ...fields } }\`
   - Content Type: \`GET {apiBase}/content/{contentTypeSlug}?limit=20\` -> response: \`{ data: [ ...entries ] }\`
   - In fetch handlers:
     \`\`\`javascript
     const fetchSingle = async () => {
       try {
         const res = await fetch('{apiBase}/single/{slug}');
         if (res.ok) {
           const json = await res.json();
           if (json.data) {
             profilDesa.value = { ...profilDesa.value, ...json.data };
           }
         }
       } catch (err) {
         // Silently keep default fallback state
       }
     };
     \`\`\`

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

  // Robust fallback defaults if still empty or unparsed
  if (!html) {
    html = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Portal Resmi Desa</title>
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
    <!-- Navbar -->
    <header class="bg-white/90 backdrop-blur-md border-b border-slate-200 sticky top-0 z-40 px-6 py-4 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white font-black text-lg shadow-sm">
          🏛️
        </div>
        <div>
          <h1 class="text-base font-black tracking-tight text-slate-900">{{ profilDesa?.nama_desa || 'Desa Intan Mandiri' }}</h1>
          <p class="text-xs text-slate-500 font-medium">{{ profilDesa?.slogan || 'Maju, Berdaya & Sejahtera' }}</p>
        </div>
      </div>
      <nav class="hidden md:flex items-center gap-1">
        <button @click="currentView = 'beranda'" :class="currentView === 'beranda' ? 'bg-emerald-50 text-emerald-700 font-bold' : 'text-slate-600 hover:text-slate-900'" class="px-3 py-1.5 rounded-lg text-xs transition-colors">Beranda</button>
        <button @click="currentView = 'statistik'" :class="currentView === 'statistik' ? 'bg-emerald-50 text-emerald-700 font-bold' : 'text-slate-600 hover:text-slate-900'" class="px-3 py-1.5 rounded-lg text-xs transition-colors">Statistik</button>
        <button @click="currentView = 'aparatur'" :class="currentView === 'aparatur' ? 'bg-emerald-50 text-emerald-700 font-bold' : 'text-slate-600 hover:text-slate-900'" class="px-3 py-1.5 rounded-lg text-xs transition-colors">Aparatur</button>
        <button @click="currentView = 'berita'" :class="currentView === 'berita' ? 'bg-emerald-50 text-emerald-700 font-bold' : 'text-slate-600 hover:text-slate-900'" class="px-3 py-1.5 rounded-lg text-xs transition-colors">Berita</button>
        <button @click="currentView = 'umkm'" :class="currentView === 'umkm' ? 'bg-emerald-50 text-emerald-700 font-bold' : 'text-slate-600 hover:text-slate-900'" class="px-3 py-1.5 rounded-lg text-xs transition-colors">Potensi UMKM</button>
      </nav>
    </header>

    <!-- Main Content -->
    <main class="flex-1 max-w-6xl w-full mx-auto px-6 py-8 space-y-10">
      <!-- Hero Banner -->
      <section class="bg-gradient-to-br from-emerald-800 to-teal-900 rounded-3xl p-8 md:p-12 text-white shadow-xl relative overflow-hidden">
        <div class="relative z-10 max-w-2xl space-y-4">
          <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-white/20 backdrop-blur-md text-emerald-100">
            ✨ Portal Digital Resmi Desa
          </span>
          <h2 class="text-3xl md:text-5xl font-black tracking-tight leading-tight">
            {{ profilDesa?.nama_desa || 'Desa Intan Mandiri' }}
          </h2>
          <p class="text-emerald-100 text-sm md:text-base leading-relaxed">
            {{ profilDesa?.sambutan_kades || 'Selamat datang di website resmi kami. Wujud transparansi informasi dan kemudahan layanan untuk seluruh warga masyarakat.' }}
          </p>
        </div>
      </section>

      <!-- Statistik Penduduk Cards -->
      <section class="space-y-4">
        <div class="flex items-center justify-between">
          <div>
            <h3 class="text-lg font-black text-slate-900">Demografi &amp; Statistik Penduduk</h3>
            <p class="text-xs text-slate-500">Data kependudukan terintegrasi langsung dengan database SaCMS</p>
          </div>
          <span class="text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">Live Terbit</span>
        </div>

        <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div class="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-1">
            <p class="text-xs font-bold text-slate-500">Total Penduduk</p>
            <p class="text-2xl font-black text-slate-900">
              {{ formatNumber(profilDesa?.statistik_penduduk_data?.total_penduduk) }}
            </p>
            <span class="text-[10px] text-emerald-600 font-bold">Jiwa terdaftar</span>
          </div>

          <div class="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-1">
            <p class="text-xs font-bold text-slate-500">Kepala Keluarga</p>
            <p class="text-2xl font-black text-slate-900">
              {{ formatNumber(profilDesa?.statistik_penduduk_data?.jumlah_kk) }}
            </p>
            <span class="text-[10px] text-blue-600 font-bold">Kartu Keluarga (KK)</span>
          </div>

          <div class="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-1">
            <p class="text-xs font-bold text-slate-500">Laki-laki</p>
            <p class="text-2xl font-black text-slate-900">
              {{ formatNumber(profilDesa?.statistik_penduduk_data?.laki_laki) }}
            </p>
            <span class="text-[10px] text-slate-500 font-bold">Jiwa</span>
          </div>

          <div class="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-1">
            <p class="text-xs font-bold text-slate-500">Perempuan</p>
            <p class="text-2xl font-black text-slate-900">
              {{ formatNumber(profilDesa?.statistik_penduduk_data?.perempuan) }}
            </p>
            <span class="text-[10px] text-slate-500 font-bold">Jiwa</span>
          </div>
        </div>
      </section>

      <!-- Aparatur & Berita Grid -->
      <section class="grid md:grid-cols-2 gap-8">
        <!-- Aparatur -->
        <div class="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
          <h3 class="text-base font-black text-slate-900 flex items-center justify-between">
            <span>Aparatur Pemerintahan Desa</span>
            <span class="text-xs font-bold text-emerald-600">{{ aparaturList.length }} Pejabat</span>
          </h3>
          <div class="space-y-3">
            <div v-for="ap in aparaturList" :key="ap._id" class="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-100">
              <div class="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-black text-sm shrink-0">
                👤
              </div>
              <div class="min-w-0">
                <p class="text-xs font-black text-slate-900 truncate">{{ ap.nama_lengkap }}</p>
                <p class="text-[11px] text-slate-500 font-medium">{{ ap.jabatan }} • NIP: {{ ap.nip || '-' }}</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Berita & Pengumuman -->
        <div class="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
          <h3 class="text-base font-black text-slate-900 flex items-center justify-between">
            <span>Berita &amp; Informasi Desa</span>
            <span class="text-xs font-bold text-emerald-600">{{ beritaList.length }} Artikel</span>
          </h3>
          <div class="space-y-3">
            <div v-for="b in beritaList" :key="b._id" class="p-3 rounded-2xl bg-slate-50 border border-slate-100 space-y-1">
              <span class="text-[10px] font-bold text-emerald-700 uppercase bg-emerald-100/60 px-2 py-0.5 rounded-full">{{ b.kategori || 'Kabar Desa' }}</span>
              <p class="text-xs font-black text-slate-900 line-clamp-1">{{ b.judul }}</p>
              <p class="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">{{ b.ringkasan }}</p>
            </div>
          </div>
        </div>
      </section>
    </main>

    <!-- Footer -->
    <footer class="bg-white border-t border-slate-200 mt-auto py-6 text-center text-xs text-slate-500">
      <p>&copy; {{ new Date().getFullYear() }} {{ profilDesa?.nama_desa || 'Desa Intan Mandiri' }}. Powered by SaCMS.</p>
    </footer>
  </div>
  <script src="app.js"></script>
</body>
</html>`
  }

  if (!js) {
    js = `const { createApp, ref, onMounted } = Vue;

const app = createApp({
  setup() {
    const currentView = ref('beranda');
    const loading = ref(true);

    // Initial safe state with complete structures
    const profilDesa = ref({
      nama_desa: "Desa Intan Mandiri",
      slogan: "Desa Maju, Berdaya & Sejahtera",
      sambutan_kades: "Selamat datang di website resmi kami. Portal ini wujud transparansi informasi dan kemudahan layanan untuk seluruh warga.",
      statistik_penduduk_data: {
        total_penduduk: 3840,
        jumlah_kk: 1120,
        laki_laki: 1920,
        perempuan: 1920,
        luas_wilayah: "14.5 km²"
      }
    });

    const aparaturList = ref([
      { _id: "1", nama_lengkap: "Drs. H. Mulyono Santoso", jabatan: "Kepala Desa", nip: "197805122005011002" },
      { _id: "2", nama_lengkap: "Siti Rahmawati, S.AP", jabatan: "Sekretaris Desa", nip: "198402182010012005" }
    ]);

    const beritaList = ref([
      { _id: "1", judul: "Penyaluran BLT Dana Desa Berjalan Tertib", kategori: "Pemerintahan", ringkasan: "Pemerintah Desa telah menyalurkan bantuan langsung tunai kepada 120 KPM penerima manfaat." },
      { _id: "2", judul: "Pelatihan Kewirausahaan Digital Pelaku UMKM", kategori: "Pemberdayaan", ringkasan: "Sebanyak 40 pelaku UMKM lokal mengikuti bimbingan teknis pemasaran online." }
    ]);

    const umkmList = ref([
      { _id: "1", nama_usaha: "Kopi Robusta Lereng Intan", harga_mulai: 35000, pemilik: "Pak Sugeng" }
    ]);

    // Helpers
    const formatNumber = (val) => Number(val || 0).toLocaleString('id-ID');
    const formatRupiah = (val) => 'Rp ' + Number(val || 0).toLocaleString('id-ID');

    // Fetch live data from SaCMS REST API
    const loadLiveData = async () => {
      loading.value = true;
      try {
        // Gunakan root-relative path yang aman dan independen dari konteks iframe / origin
        const tenantSlug = (typeof window !== 'undefined' && (window as any).__SACMS_TENANT_SLUG__) || 'd78ff319b79b5165';
        const origin = (typeof window !== 'undefined' && window.location.origin && window.location.origin !== 'null') ? window.location.origin : '';
        const apiBase = origin + '/api/public/' + tenantSlug;

        // Fetch Single Type: Profil Desa
        try {
          const resProfil = await fetch(apiBase + '/single/profil-desa');
          if (resProfil.ok) {
            const jsonProfil = await resProfil.json();
            if (jsonProfil.data) {
              profilDesa.value = { ...profilDesa.value, ...jsonProfil.data };
            }
          }
        } catch (e) {}

        // Fetch Content: Berita
        try {
          const resBerita = await fetch(apiBase + '/content/berita-pengumuman?limit=10');
          if (resBerita.ok) {
            const jsonBerita = await resBerita.json();
            if (jsonBerita.data && jsonBerita.data.length > 0) {
              beritaList.value = jsonBerita.data;
            }
          }
        } catch (e) {}

        // Fetch Content: Aparatur
        try {
          const resAparatur = await fetch(apiBase + '/content/aparatur-desa?limit=10');
          if (resAparatur.ok) {
            const jsonAparatur = await resAparatur.json();
            if (jsonAparatur.data && jsonAparatur.data.length > 0) {
              aparaturList.value = jsonAparatur.data;
            }
          }
        } catch (e) {}
      } catch (err) {
        console.warn('API fetch warning:', err);
      } finally {
        loading.value = false;
      }
    };

    onMounted(() => {
      loadLiveData();
    });

    return {
      currentView,
      loading,
      profilDesa,
      aparaturList,
      beritaList,
      umkmList,
      formatNumber,
      formatRupiah,
      loadLiveData
    };
  }
});

app.mount('#app');`
  }

  return { html, js }
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

export async function generateStaticSite(
  prompt: string,
  tenantId: string,
  tenantSlug: string,
  userId?: string,
  overrideModel?: string,
): Promise<StaticSiteResult> {
  const { resolveGatewayModel, enforceAiQuota, recordAiUsage, toUsageTotals, withAiRetry } = await import("./ai")

  const config = { tenantId, userId, creditsCost: 5, action: "generate_static_site" }

  // 1. Inisialisasi McpClientBridge dan tentukan lebih dulu apakah schema
  // auto-provisioning akan jalan, supaya pengecekan kuota di bawah mencakup
  // TOTAL biaya permintaan ini sekaligus. Mengecek hanya 5 kredit di sini
  // lalu membiarkan pembuatan skema melakukan pengecekan terpisah lagi
  // nanti memungkinkan tenant dengan saldo pas 5 kredit lolos kedua
  // pengecekan sebelum potongan pertama tercatat — total terpotong 10
  // kredit dari saldo yang cuma cukup untuk 5.
  const bridge = new McpClientBridge(tenantId, tenantSlug, userId)
  const preSchema = await bridge.getFullSchema()
  const willProvisionSchema = await shouldProvisionSchema(preSchema, prompt, overrideModel)

  await enforceAiQuota({ ...config, creditsCost: willProvisionSchema ? 10 : 5 })

  const mcpSchema = await ensureWorkspaceSchemaAndDataViaMcp(bridge, prompt, tenantId, userId, overrideModel, {
    skipQuotaCheck: true,
    knownShouldProvision: willProvisionSchema,
  })

  const apiOrigin = process.env.NEXT_PUBLIC_APP_URL || "https://sacms.cloud"
  const apiBase = `${apiOrigin.replace(/\/$/, "")}/api/public/${tenantSlug}`

  // 2. Ambil sample data riil untuk dimasukkan ke konteks prompt AI
  const liveSingleTypes = await Promise.all(
    mcpSchema.singleTypes.map(async (st) => {
      const detail = await bridge.getSingleType(st.slug)
      return {
        slug: st.slug,
        name: st.name,
        endpoint: `${apiBase}/single/${st.slug}`,
        fields: st.fields.map((f: any) => ({ slug: f.slug, type: f.type })),
        data: detail.data || null,
      }
    })
  )

  const liveContentTypes = await Promise.all(
    mcpSchema.contentTypes.map(async (ct) => {
      const q = await bridge.queryContent({ contentTypeSlug: ct.slug, limit: 2 })
      return {
        slug: ct.slug,
        name: ct.name,
        endpoint: `${apiBase}/content/${ct.slug}?limit=20`,
        fields: ct.fields.map((f: any) => ({ slug: f.slug, type: f.type })),
        sampleEntries: q.data || [],
      }
    })
  )

  const userPrompt = `Workspace Public REST API Base URL: ${apiBase}
SaCMS MCP Server Context: Connected & Synced

Live Single Types (Fetch via GET {endpoint}):
${JSON.stringify(liveSingleTypes, null, 2)}

Live Content Collections (Fetch via GET {endpoint}):
${JSON.stringify(liveContentTypes, null, 2)}

User's Goal & Design Instruction:
${prompt}

REMEMBER: In Vue 3 setup(), initialize reactive states with the exact structure of the live data above so initial rendering is immediate and immune to undefined errors. Output ONLY the two delimited blocks <<<INDEX_HTML>>>...<<<END_INDEX_HTML>>> and <<<APP_JS>>>...<<<END_APP_JS>>>.`

  const { model, modelId } = await resolveGatewayModel(overrideModel)

  const result = await withAiRetry(() =>
    generateText({
      model,
      system: SYSTEM_PROMPT,
      prompt: userPrompt,
      maxOutputTokens: 12000,
    })
  )

  const files = extractFiles(result.text)

  await recordAiUsage(config, toUsageTotals(result.usage), modelId, files.html + files.js)

  return files
}
