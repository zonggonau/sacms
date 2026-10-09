import { generateText } from "ai"
import { getTenantDb } from "./database"
import { serializeTenantSchema } from "./schema-template-sync"

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
    const items = ref([]);
    const loading = ref(true);
    const searchQuery = ref('');
    const selectedItem = ref(null);
    const isMobileMenuOpen = ref(false);

    // REST API fetcher with realistic fallback data
    // Return all reactive states and methods
    return {
      currentView,
      items,
      loading,
      searchQuery,
      selectedItem,
      isMobileMenuOpen,
    };
  }
});

app.mount('#app');
<<<END_APP_JS>>>

Visual & UX Excellence:
- Clean, modern, production-grade aesthetics (vibrant accents, dark mode compatible or sleek light palette, rounded-2xl cards, subtle shadows, micro-interactions).
- Bahasa Indonesia copy unless the user explicitly requests another language.
- Completely functional SPA: clicking navigation tabs switches views reactively, search bar filters items reactively, modal details open on click.
- Provide rich fallback mock data in Vue state so that even if database entries are empty or the API returns empty list, the website immediately looks populated, beautiful, and fully working.

Public REST API (base URL provided per-request):
- GET {apiBase}/content/{contentTypeSlug}?limit=20 — list published entries
- GET {apiBase}/content/{contentTypeSlug}/{id} — single entry
- GET {apiBase}/single/{singleTypeSlug} — single type
(No authorization headers required for public endpoints).

CRITICAL: Output ONLY the two delimited blocks (<<<INDEX_HTML>>>...<<<END_INDEX_HTML>>> and <<<APP_JS>>>...<<<END_APP_JS>>>). Do not wrap the entire response in markdown or add commentary.`

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

  // Fallback defaults if still completely empty
  if (!html) {
    html = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Website SPA</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://cdn.jsdelivr.net/npm/vue@3/dist/vue.global.prod.js"></script>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    body { font-family: 'Plus Jakarta Sans', sans-serif; }
    [v-cloak] { display: none; }
  </style>
</head>
<body class="bg-slate-50 text-slate-900 antialiased min-h-screen">
  <div id="app" v-cloak class="p-8 max-w-4xl mx-auto">
    <h1 class="text-3xl font-bold">{{ title }}</h1>
    <p class="text-slate-600 mt-2">{{ description }}</p>
  </div>
  <script src="app.js"></script>
</body>
</html>`
  }

  if (!js) {
    js = `const { createApp, ref } = Vue;

const app = createApp({
  setup() {
    const title = ref("Website SaCMS");
    const description = ref("Website SPA berhasil disiapkan dengan Vue.js 3.");
    return { title, description };
  }
});

app.mount('#app');`
  }

  return { html, js }
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
  await enforceAiQuota(config)

  const tenantDb = await getTenantDb(tenantSlug)
  const schema = await serializeTenantSchema(tenantDb, { tenantId })

  const apiOrigin = process.env.NEXT_PUBLIC_APP_URL || "https://sacms.cloud"
  const apiBase = `${apiOrigin.replace(/\/$/, "")}/api/public/${tenantSlug}`

  const userPrompt = `Workspace API base URL: ${apiBase}

Available schema (Content Types / Single Types / Components this site can fetch from):
${JSON.stringify(schema, null, 2)}

User's request for the site:
${prompt}`

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
