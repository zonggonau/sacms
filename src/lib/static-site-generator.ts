import { z } from "zod"
import { generateObject } from "ai"
import { getTenantDb } from "./database"
import { serializeTenantSchema } from "./schema-template-sync"

const staticSiteSchema = z.object({
  html: z.string().describe("Complete, valid HTML5 document — <!DOCTYPE html> through </html>. Must load Alpine.js via CDN script tag in <head>. No <script> containing app logic inline here — that goes in `js`."),
  js: z.string().describe("The app's Alpine.js logic — Alpine.data(...) component definitions and any fetch() calls against the Public REST API. This gets inlined into the page before </body>."),
})

const SYSTEM_PROMPT = `You are an expert at building fast, zero-build static websites for small businesses (UMKM) using a headless CMS's public API.

Hard constraints:
- Output a COMPLETE HTML5 document (<!DOCTYPE html> ... </html>) in \`html\`, and the site's JS logic separately in \`js\`.
- In <head>, load Alpine.js from CDN: <script defer src="https://cdn.jsdelivr.net/npm/alpinejs@3.x.x/dist/cdn.min.js"></script>
- Use Alpine's x-data/x-for/x-text/x-show/x-if directives for rendering. Never use innerHTML with API data — only x-text (auto-escaped) for untrusted text content.
- \`js\` should define page state via document.addEventListener('alpine:init', () => { Alpine.data('site', () => ({ ... })) }) and fetch data from the Public REST API inside init()/methods, storing results in reactive state.
- No build tools, no npm packages, no frameworks besides Alpine via the CDN tag above. Plain CSS (inline <style> in <head> is fine) — no Tailwind CDN unless explicitly asked.
- Write all visible copy in Bahasa Indonesia unless the prompt says otherwise.
- Make it a genuinely complete, attractive single-page site: hero, relevant content sections pulling from the schema below, a footer with contact info if available. Not a placeholder.

CRITICAL — the schema given to you per-request is the COMPLETE and ONLY list of content types/single types/components that exist for this workspace:
- NEVER fetch a contentTypeSlug or singleTypeSlug that is not literally present in that schema. Do not guess or invent plausible-sounding slugs (e.g. "company-settings", "about-us", "profile") just because a typical business site would have one — if it is not in the schema, it does not exist in this tenant's database and fetching it will 404.
- If the schema is empty, or lacks data for a section the user's prompt implies (e.g. they want a "company profile" section but there is no matching single type), write that section as static copy authored directly from the user's prompt instead of fetching anything for it. A site built entirely from static copy (zero fetch calls) is a completely valid and correct output when the schema has nothing relevant.
- Every fetch() call must handle failure gracefully and silently: on a non-ok response or thrown error, hide that section (or fall back to static placeholder copy) — NEVER render the error object, HTTP status, or any raw technical message in the page. A visitor must never see words like "Gagal memuat..." or "404 Not Found" anywhere.

Public REST API (base URL given per-request):
- GET {apiBase}/content/{contentTypeSlug} — list published entries (supports ?pagination[page]=1&pagination[pageSize]=20, ?filters[field][$eq]=value)
- GET {apiBase}/content/{contentTypeSlug}/{id} — single entry
- GET {apiBase}/single/{singleTypeSlug} — single type data
No Authorization header needed — these are public, published-content-only endpoints.`

export interface StaticSiteResult {
  html: string
  js: string
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
    generateObject({
      model,
      schema: staticSiteSchema,
      system: SYSTEM_PROMPT,
      prompt: userPrompt,
      maxOutputTokens: 12000,
    })
  )

  await recordAiUsage(config, toUsageTotals(result.usage), modelId, result.object.html + result.object.js)

  return result.object
}
